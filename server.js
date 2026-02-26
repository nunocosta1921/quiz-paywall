import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.static('public'));
app.use(express.json());

// Criar sessão de pagamento Stripe
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { quizToken, score } = req.body;

    if (!quizToken) return res.status(400).json({ error: 'Falta quizToken' });
    if (typeof score !== 'number') return res.status(400).json({ error: 'Falta score' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.PRICE_EUR_1, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&token=${encodeURIComponent(quizToken)}`,
      cancel_url: `${process.env.BASE_URL}/cancel.html`,
      metadata: {
        quizToken,
        score: String(score) // guardamos como texto
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
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
      score: session.metadata?.score ? Number(session.metadata.score) : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

const PORT = 4242;
app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));