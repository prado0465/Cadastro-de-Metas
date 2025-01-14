import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import moment from 'moment';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  TablePagination,
  Card,
  CardContent,
  Checkbox,
  Tooltip,
} from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { CSVLink } from 'react-csv';
import { useMediaQuery } from '@mui/material';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const itemValues = {
  PROD0070: 4166.69,
  PROD0071: 4385.96,
  INTE9005: 2238.81,
  INTE9009: 2112.68,
  INTE9020: 2112.68,
};

const hours = {
  sim: 18.90,
  nao: 17.02,
};

const buttonStyle = {
  marginBottom: '10px',
  transition: 'transform 0.2s',
};

const buttonClickStyle = {
  transform: 'scale(0.95)',
};

const logoStyle = {
  width: '45%',
  maxWidth: '150px',
  margin: '8px',
  padding: '15px',
  transition: 'transform 0.3s ease-in-out',
};

function App() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [metas, setMetas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search] = useState('');
  const [data, setData] = useState('')
  const [quantidadeProd, setQuantidadeProd] = useState('');
  const [horaExtra, setHoraExtra] = useState('nao');
  const [editingMeta, setEditingMeta] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  const [quantidadeProgramada, setQuantidadeProgramada] = useState('0.00');
  const [percentual, setPercentual] = useState('0.00');

  const [selectedMetas, setSelectedMetas] = useState([]);

  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);

  const [clickedButton, setClickedButton] = useState(null);

  const [exportFormat, setExportFormat] = useState('csv');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://192.168.2.54:3001';

  const isMobile = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    setIsLoading(true);
    Promise.all([axios.get(`${API_BASE_URL}/items`), axios.get(`${API_BASE_URL}/metas`)])
      .then(([itemsResponse, metasResponse]) => {
        setItems(itemsResponse.data);
        setMetas(metasResponse.data);
      })
      .catch(() => toast.error('Erro ao carregar dados.'))
      .finally(() => setIsLoading(false));
  }, [API_BASE_URL]);

  const calculateQuantidade = useCallback(() => {
    const itemValue = itemValues[selectedItem.trim()] || 0;
    const hoursValue = hours[horaExtra] || 0;
    return (itemValue * hoursValue).toFixed(2);
  }, [selectedItem, horaExtra]);

  const calculatePercentual = useCallback(() => {
    const qtd = parseFloat(calculateQuantidade());
    if (quantidadeProd && qtd) {
      return ((parseFloat(quantidadeProd) / qtd) * 100).toFixed(2);
    }
    return '0.00';
  }, [quantidadeProd, calculateQuantidade]);

  useEffect(() => {
    setQuantidadeProgramada(calculateQuantidade());
  }, [calculateQuantidade]);

  useEffect(() => {
    setPercentual(calculatePercentual());
  }, [calculatePercentual]);

  const handleInsert = () => {
    if (!selectedItem.trim() || !data || !quantidadeProd || Number(quantidadeProd) <= 0) {
      toast.error('Preencha todos os campos corretamente.');
      return;
    }

    const quantidadeCalculada = calculateQuantidade();
    const percentualCalculado = calculatePercentual();

    if (quantidadeCalculada <= 0) {
      toast.error('Não é possível inserir uma meta com quantidade calculada igual ou inferior a zero.');
      return;
    }

    setIsLoading(true);
    axios
      .post(`${API_BASE_URL}/metas`, {
        item: selectedItem.trim(),
        data,
        quantidade: quantidadeCalculada,
        quantidadeProd,
        horaExtra: horaExtra === 'sim' ? 1 : 0,
        percentual: percentualCalculado,
      })
      .then(() => {
        toast.success('Meta adicionada com sucesso!');
        setMetas([...metas, {
          MP_ITEM: selectedItem.trim(),
          MP_DATA: data,
          MP_QTD: quantidadeCalculada,
          MP_QTDPROD: quantidadeProd,
          MP_HREXT: horaExtra === 'sim' ? 1 : 0,
          MP_PERQTD: percentualCalculado,
        }]);
        setSelectedItem('');
        setData('');
        setQuantidadeProd('');
        setHoraExtra('nao');
      })
      .catch(() => toast.error('Erro ao adicionar meta.'))
      .finally(() => setIsLoading(false));
  };

  const handleDelete = () => {
    axios
      .delete(`${API_BASE_URL}/metas/${deleteId}`)
      .then(() => {
        toast.success('Meta excluída com sucesso!');
        setMetas((prevMetas) => prevMetas.filter((meta) => meta.MP_ID !== deleteId));
      })
      .catch(() => toast.error('Erro ao excluir meta.'))
      .finally(() => {
        setOpenDialog(false);
        setDeleteId(null);
      });
  };

  const handleEdit = (meta) => {
    setEditingMeta(meta);
    setSelectedItem(meta.MP_ITEM);
    setData(moment(meta.MP_DATA).format('YYYY-MM-DD'));
    setQuantidadeProd(meta.MP_QTDPROD);
    setHoraExtra(meta.MP_HREXT === 1 ? 'sim' : 'nao');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmUpdate = () => {
    setOpenUpdateDialog(true);
  };

  const handleCloseUpdateDialog = () => {
    setOpenUpdateDialog(false);
  };

  const handleUpdateConfirmed = () => {
    handleUpdate();
    setOpenUpdateDialog(false);
  };

  const handleUpdate = () => {
    if (!selectedItem.trim() || !data || !quantidadeProd || Number(quantidadeProd) <= 0) {
      toast.error('Preencha todos os campos corretamente.');
      return;
    }

    const qtd = calculateQuantidade();
    const percentual = calculatePercentual();

    setIsLoading(true);
    axios
      .put(`${API_BASE_URL}/metas/${editingMeta.MP_ID}`, { item: selectedItem.trim(), data, quantidade: qtd, quantidadeProd, horaExtra: horaExtra === 'sim' ? 1 : 0, percentual })
      .then(() => {
        toast.success('Meta atualizada com sucesso!');
        setMetas((prevMetas) =>
          prevMetas.map((meta) =>
            meta.MP_ID === editingMeta.MP_ID
              ? { ...meta, MP_ITEM: selectedItem.trim(), MP_DATA: data, MP_QTD: qtd, MP_QTDPROD: quantidadeProd, MP_HREXT: horaExtra === 'sim' ? 1 : 0, MP_PERQTD: percentual }
              : meta
          )
        );
        setSelectedItem('');
        setData('');
        setQuantidadeProd('');
        setHoraExtra('nao');
        setEditingMeta(null);

      })
      .catch(() => toast.error('Erro ao atualizar meta.'))
      .finally(() => setIsLoading(false));
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectMeta = (meta) => {
    setSelectedMetas((prevSelected) => {
      if (prevSelected.some(selectedMeta => selectedMeta.MP_ID === meta.MP_ID)) {
        return prevSelected.filter((m) => m.MP_ID !== meta.MP_ID);
      } else {
        return [...prevSelected, meta];
      }
    });
  };

  const handleDeselectAll = () => {
    setSelectedMetas([]);
  };

  const handleSelectAll = () => {
    setSelectedMetas(filteredMetas);
  };

  const handleClearForm = () => {
    setSelectedItem('');
    setData('');
    setQuantidadeProd('');
    setHoraExtra('nao');
    setEditingMeta(null);
  };

  const csvHeaders = [
    { label: 'ID', key: 'MP_ID' },
    { label: 'Descrição do Item', key: 'ITEM_DESC' },
    { label: 'Data', key: 'MP_DATA' },
    { label: 'Quantidade Programada', key: 'MP_QTD' },
    { label: 'Quantidade Produzida', key: 'MP_QTDPROD' },
    { label: 'Hora Extra', key: 'MP_HREXT' },
    { label: 'Percentual', key: 'MP_PERQTD' },
  ];

  const csvData = selectedMetas.map(meta => {
    const item = items.find(i => i.B1_COD.trim() === meta.MP_ITEM.trim());
    return {
      ...meta,
      ITEM_DESC: item ? item.ITEM : '',
      MP_HREXT: meta.MP_HREXT === 1 ? 'Sim' : 'Não',
    };
  });

  const filteredMetas = metas.map(meta => {
    const item = items.find(i => i.B1_COD.trim() === meta.MP_ITEM.trim());
    return {
      ...meta,
      ITEM_DESC: item ? item.ITEM : '',
      MP_DATA: moment(meta.MP_DATA).format('YYYY-MM-DD')
    };
  }).filter((meta) =>
    meta.ITEM_DESC?.toLowerCase().includes(search.toLowerCase()) ||
    meta.MP_ITEM?.toLowerCase().includes(search.toLowerCase())
  );

  const handleItemChange = (e) => {
    setSelectedItem(e.target.value.trim());
  };

  const handleDateChange = (e) => {
    setData(e.target.value);
  };

  const handleHoraExtraChange = (e) => {
    setHoraExtra(e.target.value);
  };

  const handleQuantidadeProdChange = (e) => {
    const value = e.target.value;
    if (/^\d*(\.\d{0,2})?$/.test(value)) {
      setQuantidadeProd(value);
    }
  };

  const handleButtonClick = (callback, buttonId) => {
    setClickedButton(buttonId);
    setTimeout(() => {
      setClickedButton(null);
      callback();
    }, 200);
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      document.getElementById('csv-export-link').click();
    } else if (exportFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(csvData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Metas');
      XLSX.writeFile(wb, 'metas_nutriz.xlsx');
    } else if (exportFormat === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Metas de Produção', 14, 22);
      doc.setFontSize(12);
      doc.setTextColor(100);

      const headers = [['ID', 'Descrição do Item', 'Data', 'Quantidade Programada', 'Quantidade Produzida', 'Hora Extra', 'Percentual']];
      const data = csvData.map(meta => [
        meta.MP_ID,
        meta.ITEM_DESC,
        meta.MP_DATA,
        meta.MP_QTD,
        meta.MP_QTDPROD,
        meta.MP_HREXT,
        meta.MP_PERQTD,
      ]);

      doc.autoTable({
        head: headers,
        body: data,
        startY: 30,
        theme: 'striped',
        headStyles: { fillColor: [22, 160, 133] },
        styles: { cellPadding: 3, fontSize: 10 },
        margin: { top: 30 },
        didDrawPage: (data) => {

          doc.setFontSize(20);
          doc.setTextColor(40);
          doc.text('Metas de Produção', data.settings.margin.left, 22);


          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        },
      });

      doc.save('metas_nutriz.pdf');
    }
  };

  return (
    <div style={{ backgroundColor: '#F5FFFA', minHeight: '100vh' }}>
      <img
        src='https://www.nutriz.com.br/static/media/logo.c654380388ad2deaec40.png'
        alt='logo'
        style={logoStyle}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onClick={() => window.location.reload()}
      />
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <ToastContainer />
        <Typography variant={isMobile ? "h5" : "h4"} align="center" gutterBottom>
          Cadastro de Metas de Produção
        </Typography>
        {isLoading && <CircularProgress style={{ display: 'block', margin: '0 auto' }} />}
        <Card style={{ marginBottom: '20px' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <Select
                  value={selectedItem.trim()}
                  onChange={handleItemChange}
                  fullWidth
                  displayEmpty
                  style={{ marginBottom: '10px' }}
                >
                  <MenuItem value="">
                    <em>Selecione o Item</em>
                  </MenuItem>
                  {items.map((item) => (
                    <MenuItem key={item.B1_COD.trim()} value={item.B1_COD.trim()}>
                      {item.B1_COD.trim()} - {item.ITEM}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Data"
                  type="date"
                  variant="outlined"
                  fullWidth
                  value={data || ''}
                  onChange={handleDateChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  style={{ marginBottom: '10px' }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Select
                  value={horaExtra}
                  onChange={handleHoraExtraChange}
                  fullWidth
                  displayEmpty
                  style={{ marginBottom: '10px' }}
                >
                  <MenuItem value="nao">
                    <em>Hora Extra Não</em>
                  </MenuItem>
                  <MenuItem value="sim">
                    <em>Hora Extra Sim</em>
                  </MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Quantidade Produzida"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={quantidadeProd || ''}
                  onChange={handleQuantidadeProdChange}
                  style={{ marginBottom: '10px' }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Quantidade Programada"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={quantidadeProgramada}
                  InputProps={{
                    readOnly: true,
                  }}
                  style={{ marginBottom: '10px' }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Percentual"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={percentual}
                  InputProps={{
                    readOnly: true,
                  }}
                  style={{ marginBottom: '10px' }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  fullWidth
                  displayEmpty
                  style={{ marginBottom: '10px' }}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="excel">Excel</MenuItem>
                  <MenuItem value="pdf">PDF</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color={editingMeta ? 'secondary' : 'primary'}
                  onClick={() => handleButtonClick(editingMeta ? handleConfirmUpdate : handleInsert, 'insert')}
                  fullWidth
                  disabled={isLoading}
                  style={{ ...buttonStyle, ...(clickedButton === 'insert' ? buttonClickStyle : {}) }}
                >
                  {isLoading ? <CircularProgress size={24} /> : (editingMeta ? 'Atualizar Meta' : 'Adicionar Meta')}
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => handleButtonClick(handleClearForm, 'clear')}
                  fullWidth
                  style={{ ...buttonStyle, ...(clickedButton === 'clear' ? buttonClickStyle : {}) }}
                >
                  Limpar Formulário
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ ...buttonStyle, ...(clickedButton === 'deselect' ? buttonClickStyle : {}) }}
                  disabled={selectedMetas.length === 0}
                  onClick={() => handleButtonClick(handleDeselectAll, 'deselect')}
                >
                  Descmarcar Todos
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ ...buttonStyle, ...(clickedButton === 'selectAll' ? buttonClickStyle : {}) }}
                  onClick={() => handleButtonClick(handleSelectAll, 'selectAll')}
                >
                  Selecionar Todos
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ ...buttonStyle, ...(clickedButton === 'export' ? buttonClickStyle : {}) }}
                  disabled={selectedMetas.length === 0}
                  onClick={() => handleButtonClick(handleExport, 'export')}
                >
                  Exportar Selecionados
                </Button>
                <CSVLink
                  data={csvData}
                  headers={csvHeaders}
                  filename="metas_nutriz.csv"
                  id="csv-export-link"
                  style={{ display: 'none' }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <TableContainer component={Paper} style={{ marginTop: '20px' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Selecionar</TableCell>
                <TableCell>Item</TableCell>
                <TableCell>Descrição do Item</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Quantidade Programada</TableCell>
                <TableCell>Quantidade Produzida</TableCell>
                <TableCell>Hora Extra</TableCell>
                <TableCell>Percentual</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMetas
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((meta) => (
                  <TableRow key={meta.MP_ID} style={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMetas.some(selectedMeta => selectedMeta.MP_ID === meta.MP_ID)}
                        onChange={() => handleSelectMeta(meta)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>{meta.MP_ITEM}</TableCell>
                    <TableCell>{meta.ITEM_DESC}</TableCell>
                    <TableCell>{new Date(meta.MP_DATA).toLocaleDateString()}</TableCell>
                    <TableCell>{meta.MP_QTD}</TableCell>
                    <TableCell>{meta.MP_QTDPROD}</TableCell>
                    <TableCell>{meta.MP_HREXT === 1 ? 'Sim' : 'Não'}</TableCell>
                    <TableCell>{meta.MP_PERQTD}</TableCell>
                    <TableCell>
                      <Tooltip title="Editar">
                        <IconButton onClick={(e) => { e.stopPropagation(); handleEdit(meta); }} color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          onClick={(e) => { e.stopPropagation(); setOpenDialog(true); setDeleteId(meta.MP_ID); }}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[]} 
            component="div"
            count={filteredMetas.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
        >
          <DialogTitle>Confirmar a Exclusão</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Tem certeza que deseja excluir esta meta? Esta ação não poderá ser desfeita (:
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)} color="primary">
              Cancelar
            </Button>
            <Button onClick={handleDelete} color="error">
              Excluir
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={openUpdateDialog}
          onClose={handleCloseUpdateDialog}
        >
          <DialogTitle>Confirmar Atualização</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Tem certeza que deseja atualizar esta meta?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseUpdateDialog} color="primary">
              Cancelar
            </Button>
            <Button onClick={handleUpdateConfirmed} color="primary">
              Atualizar
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
}

export default App;