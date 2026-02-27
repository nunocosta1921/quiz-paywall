import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const app = express();

app.use(express.static('public'));
app.use(express.json());

// Variáveis obrigatórias
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_EUR_1 = process.env.PRICE_EUR_1;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4242}`;

if (!STRIPE_SECRET_KEY) console.warn("⚠️ Falta STRIPE_SECRET_KEY (tem de ser sk_live_... ou sk_test_...)");
if (!PRICE_EUR_1) console.warn("⚠️ Falta PRICE_EUR_1 (tem de ser price_...)");
if (!BASE_URL) console.warn("⚠️ Falta BASE_URL");

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Criar sessão de pagamento Stripe
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { quizToken, score } = req.body;

    if (!quizToken) return res.status(400).json({ error: 'Falta quizToken' });
    if (typeof score !== 'number') return res.status(400).json({ error: 'Falta score' });
    if (!PRICE_EUR_1) return res.status(500).json({ error: 'Config em falta: PRICE_EUR_1' });
    if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Config em falta: STRIPE_SECRET_KEY' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'mbway'], // + 'multibanco' se quiseres
      line_items: [{ price: PRICE_EUR_1, quantity: 1 }],
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(quizToken)}`,
      cancel_url: `${BASE_URL}/cancel.html`,
      metadata: {
        quizToken,
        score: String(score),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erro create-checkout-session:", error);
    res.status(500).json({ error: error?.message || 'Erro ao criar sessão Stripe' });
  }
});

// Verificar pagamento + devolver score
app.get('/verify', async (req, res) => {
  try {
    const { session_id, token } = req.query;
    if (!session_id || !token) return res.status(400).json({ ok: false });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const pagamentoConfirmado = session.payment_status === 'paid';
    const tokenCorreto = session.metadata?.quizToken === token;

    res.json({
      ok: Boolean(pagamentoConfirmado && tokenCorreto),
      score: session.metadata?.score ? Number(session.metadata.score) : null,
    });
  } catch (error) {
    console.error("Erro verify:", error);
    res.status(500).json({ ok: false, error: error?.message || "Erro verify" });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`✅ Servidor ativo na porta ${PORT}`);
  console.log(`🌐 BASE_URL: ${BASE_URL}`);
});