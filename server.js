import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const app = express();

app.use(express.static('public'));
app.use(express.json());

// ENV
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_EUR_1 = process.env.PRICE_EUR_1;

const PORT = process.env.PORT || 4242;

// Se BASE_URL não existir:
// - local: http://localhost:4242
// - produção: (tens MESMO de definir no Render)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!STRIPE_SECRET_KEY) console.warn("⚠️ Falta STRIPE_SECRET_KEY (sk_test_... ou sk_live_...)");
if (!PRICE_EUR_1) console.warn("⚠️ Falta PRICE_EUR_1 (price_...)");
console.log("🌐 BASE_URL:", BASE_URL);

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Criar sessão de pagamento Stripe
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { quizToken, score } = req.body;

    if (!quizToken) return res.status(400).json({ error: 'Falta quizToken' });
    if (typeof score !== 'number') return res.status(400).json({ error: 'Falta score (number)' });
    if (!PRICE_EUR_1) return res.status(500).json({ error: 'Config em falta: PRICE_EUR_1' });
    if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Config em falta: STRIPE_SECRET_KEY' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_EUR_1, quantity: 1 }],

      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(quizToken)}`,
      cancel_url: `${BASE_URL}/cancel.html`,

      metadata: {
        quizToken,
        score: String(score),
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe error:", {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      param: error?.param,
      statusCode: error?.statusCode,
      raw: error?.raw,
    });

    return res.status(500).json({ error: error?.message || 'Erro ao criar sessão Stripe' });
  }
});

// Verificar pagamento + devolver score
app.get('/verify', async (req, res) => {
  try {
    const { session_id, token } = req.query;
    if (!session_id || !token) return res.status(400).json({ ok: false, error: "Falta session_id ou token" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const pago = session.payment_status === 'paid';
    const tokenOk = session.metadata?.quizToken === token;

    return res.json({
      ok: Boolean(pago && tokenOk),
      score: session.metadata?.score ? Number(session.metadata.score) : null,
    });
  } catch (error) {
    console.error("❌ Verify error:", error?.message || error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro verify" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ativo na porta ${PORT}`);
});