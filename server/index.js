import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Exemplo de rota de API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor Backend do Ciclo a Aprovação rodando!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
