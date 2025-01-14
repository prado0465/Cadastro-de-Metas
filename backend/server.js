const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();
const moment = require('moment');
const { celebrate, Joi, errors, Segments } = require('celebrate');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
});

app.use(limiter);

const protheusConfig = {
  user: process.env.PROTHEUS_USER,
  password: process.env.PROTHEUS_PASSWORD,
  server: process.env.PROTHEUS_SERVER,
  database: process.env.PROTHEUS_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000, 
  },
};

const programacaoConfig = {
  user: process.env.PROGRAMACAO_USER,
  password: process.env.PROGRAMACAO_PASSWORD,
  server: process.env.PROGRAMACAO_SERVER,
  database: process.env.PROGRAMACAO_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000,
  },
};
app.locals.poolProgramacao = new sql.ConnectionPool(programacaoConfig);

async function connectProtheus() {
  try {
    const pool = new sql.ConnectionPool(protheusConfig);
    await pool.connect();
    console.log('Conectado ao banco Protheus!');
    return pool;
  } catch (err) {
    console.error('Erro ao conectar ao banco Protheus:', err.message);
    throw err;
  }
}

async function connectProgramacao() {
  try {
    const pool = new sql.ConnectionPool(programacaoConfig);
    await pool.connect();
    console.log('Conectado ao banco Programação!');
    return pool;
  } catch (err) {
    console.error('Erro ao conectar ao banco Programacao:', err.message);
    throw err;
  }
}
app.locals.poolProtheus = connectProtheus();

app.use((req, res, next) => {
  req.poolProtheus = app.locals.poolProtheus;
  req.poolProgramacao = app.locals.poolProgramacao;
  next();
});

app.get('/items', async (req, res, next) => {
  try {
    const pool = req.poolProtheus;

    const query = `
      SELECT B1_COD, 
             RTRIM(LTRIM(B1_DESC)) AS ITEM
      FROM SB1010
      WHERE B1_GRUPO = '0055' AND B1_SERIE = '1'
      ORDER BY B1_COD
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

app.get('/metas', async (req, res, next) => {
  try {
    const pool = req.poolProgramacao;

    const query = `
      SELECT MP_ID, MP_ITEM, 
             FORMAT(MP_DATA, 'yyyy-MM-dd') AS MP_DATA, 
             MP_QTD, MP_QTDPROD, MP_HREXT, MP_PERQTD
      FROM METAS_PROD
      ORDER BY MP_ID DESC
    `;
    
    const result = await pool.request().query(query);

    const metas = result.recordset.map(meta => ({
      ...meta,
      MP_DATA: moment(meta.MP_DATA).format('YYYY-MM-DD') 
    }));

    res.json(metas);
  } catch (error) {
    next(error);
  }
});

app.post('/metas', celebrate({
  [Segments.BODY]: Joi.object().keys({
    item: Joi.string().required(),
    data: Joi.date().required(),
    quantidade: Joi.number().required(),
    quantidadeProd: Joi.number().required(),
    horaExtra: Joi.number().integer().required(),
    percentual: Joi.number().required(),
  }),
}), async (req, res, next) => {
  try {
    const { item, data, quantidade, quantidadeProd, horaExtra, percentual } = req.body;

    if (!item || !data || !quantidade || !quantidadeProd || horaExtra === undefined || !percentual) {
      return res.status(400).send('Todos os campos são obrigatórios.');
    }

    const formattedDate = moment.utc(data).format('YYYY-MM-DD');

    const quantidadeFloat = parseFloat(quantidade);
    const quantidadeProdFloat = parseFloat(quantidadeProd);
    let percentualFloat = parseFloat(percentual);

    if (!isFinite(percentualFloat)) {
      percentualFloat = 0;
    }

    console.log('Valores recebidos:', {
      item,
      data: formattedDate,
      quantidade: quantidadeFloat,
      quantidadeProd: quantidadeProdFloat,
      horaExtra,
      percentual: percentualFloat,
    });

    const pool = req.poolProgramacao;

    const query = `
      INSERT INTO METAS_PROD (MP_ITEM, MP_DATA, MP_QTD, MP_QTDPROD, MP_HREXT, MP_PERQTD)
      VALUES (@item, @data, @quantidade, @quantidadeProd, @horaExtra, @percentual)
    `;
    await pool
      .request()
      .input('item', sql.VarChar, item)
      .input('data', sql.Date, formattedDate)
      .input('quantidade', sql.Float, quantidadeFloat)
      .input('quantidadeProd', sql.Float, quantidadeProdFloat)
      .input('horaExtra', sql.Int, horaExtra)
      .input('percentual', sql.Float, percentualFloat)
      .query(query);

    res.status(201).send('Meta inserida com sucesso!');
  } catch (error) {
    console.error('Erro ao inserir meta:', error.message);
    next(error);
  }
});

app.put('/metas/:id', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.number().integer().required(),
  }),
  [Segments.BODY]: Joi.object().keys({
    item: Joi.string().required(),
    data: Joi.date().required(),
    quantidade: Joi.number().required(),
    quantidadeProd: Joi.number().required(),
    horaExtra: Joi.number().integer().required(),
    percentual: Joi.number().required(),
  }),
}), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { item, data, quantidade, quantidadeProd, horaExtra, percentual } = req.body;

    if (!id || !item || !data || !quantidade || !quantidadeProd || horaExtra === undefined || !percentual) {
      return res.status(400).send('Todos os campos são obrigatórios.');
    }

    const formattedDate = moment.utc(data).format('YYYY-MM-DD');

    const quantidadeFloat = parseFloat(quantidade);
    const quantidadeProdFloat = parseFloat(quantidadeProd);
    let percentualFloat = parseFloat(percentual);

    if (!isFinite(percentualFloat)) {
      percentualFloat = 0;
    }

    console.log('Valores recebidos:', {
      id,
      item,
      data: formattedDate,
      quantidade: quantidadeFloat,
      quantidadeProd: quantidadeProdFloat,
      horaExtra,
      percentual: percentualFloat,
    });

    const pool = req.poolProgramacao;

    const query = `
      UPDATE METAS_PROD
      SET MP_ITEM = @item, MP_DATA = @data, MP_QTD = @quantidade, MP_QTDPROD = @quantidadeProd, MP_HREXT = @horaExtra, MP_PERQTD = @percentual
      WHERE MP_ID = @id
    `;
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('item', sql.VarChar, item)
      .input('data', sql.Date, formattedDate)
      .input('quantidade', sql.Float, quantidadeFloat)
      .input('quantidadeProd', sql.Float, quantidadeProdFloat)
      .input('horaExtra', sql.Int, horaExtra)
      .input('percentual', sql.Float, percentualFloat)
      .query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).send('Meta não encontrada.');
    }

    res.send('Meta atualizada com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar meta:', error.message);
    next(error);
  }
});

app.delete('/metas/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).send('O ID da meta é obrigatório.');
    }

    const pool = req.poolProgramacao;

    const query = `
      DELETE FROM METAS_PROD WHERE MP_ID = @id
    `;
    const result = await pool.request().input('id', sql.Int, id).query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).send('Meta não encontrada.');
    }

    res.send('Meta excluída com sucesso!');
  } catch (error) {
    console.error('Erro ao excluir meta:', error.message);
    next(error);
  }
});

app.use(errors());

app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(500).send(err.message || 'Erro interno no servidor.');
});

async function startServer() {
  try {
    const poolProtheus = await connectProtheus();
    const poolProgramacao = await connectProgramacao();

    app.locals.poolProtheus = poolProtheus;
    app.locals.poolProgramacao = poolProgramacao;

    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error.message);
  }
}

startServer();