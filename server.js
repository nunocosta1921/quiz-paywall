import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const app = express();

// Stripe key (LIVE ou TESTE) vem do Render/.env
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ Falta STRIPE_SECRET_KEY nas variáveis de ambiente.");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// BASE_URL deve ser tipo: https://quiz-paywall.onrender.com
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4242}`;

// PRICE_EUR_1 deve ser o price_... (LIVE ou TESTE)
if (!process.env.PRICE_EUR_1) {
  console.warn("⚠️ Falta PRICE_EUR_1 nas variáveis de ambiente (price_...).");
}

app.use(express.static('public'));
app.use(express.json());

// Criar sessão de pagamento Stripe
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { quizToken, score } = req.body;

    if (!quizToken) return res.status(400).json({ error: 'Falta quizToken' });
    if (typeof score !== 'number') return res.status(400).json({ error: 'Falta score' });
    if (!process.env.PRICE_EUR_1) return res.status(500).json({ error: 'Config em falta: PRICE_EUR_1' });

    const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card', 'mbway'], // + 'multibanco' se quiseres
  line_items: [{ price: process.env.PRICE_EUR_1, quantity: 1 }],
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
    res.status(500).json({ error: 'Erro ao criar sessão Stripe' });
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
    res.status(500).json({ ok: false });
  }
});

// Render dá PORT automaticamente
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`✅ Servidor ativo na porta ${PORT}`);
  console.log(`🌐 BASE_URL: ${BASE_URL}`);
});