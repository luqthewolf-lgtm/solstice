/**
 * Auditoria 2026.6 (BR-NUM / SOL-T1) — regressão da inferência de tipos
 * ciente de formato numérico brasileiro.
 *
 * Bug original (encontrado por teste de experiência com Playwright sobre um CSV
 * pt-BR real): valores como "20.729,20" (milhar com ponto + decimal vírgula)
 * falhavam em TODAS as regexes numéricas, então colunas de DINHEIRO reais eram
 * classificadas como 'dimension' (texto) e ficavam não-agregáveis. Pior: a
 * regex CURRENCY casava com inteiros puros ("29") e era testada antes de
 * 'integer', então contagens viravam 'moeda'.
 *
 * Estes testes travam o comportamento correto.
 */
import { describe, it, expect } from 'vitest';
import { SolsticeTypes } from './dist/types.mjs';

const col = (vals, name) => SolsticeTypes.inferColumn(vals, name, {});
const groupOf = (vals, name) => SolsticeTypes.group(col(vals, name).type);

describe('SolsticeTypes.inferColumn — números pt-BR', () => {
  it('receita "20.729,20" (milhar+decimal BR) é numérica, não dimension', () => {
    const vals = ['20.729,20', '841,45', '147.637,70', '61.762,80', '195.059,32'];
    const r = col(vals, 'receita_total');
    expect(r.type).not.toBe('dimension');
    expect(groupOf(vals, 'receita_total')).toBe('numeric');
  });

  it('preço "1.403,70" (com agrupador) é numérica, não dimension', () => {
    const vals = ['714,80', '1.403,70', '2.109,11', '4.240,42', '19,90'];
    expect(groupOf(vals, 'preco_unitario')).toBe('numeric');
  });

  it('contagem "29" vira integer, não currency (sem símbolo monetário)', () => {
    const vals = ['29', '5', '70', '44', '46', '12', '1', '80'];
    expect(col(vals, 'qtd_vendas').type).toBe('integer');
  });

  it('valor com símbolo "R$ 1.234,56" é currency', () => {
    const vals = ['R$ 1.234,56', 'R$ 99,90', 'R$ 12.000,00', 'R$ 7,50'];
    expect(col(vals, 'valor').type).toBe('currency');
  });

  it('formato US "20,729.20" também é reconhecido como numérico', () => {
    const vals = ['20,729.20', '841.45', '147,637.70', '1,234.00'];
    expect(groupOf(vals, 'amount')).toBe('numeric');
  });
});

describe('SolsticeTypes.inferColumn — não-numéricos não regridem', () => {
  it('UF continua categórica/geo (não numérica)', () => {
    const vals = ['SP', 'RJ', 'MG', 'BA', 'PR', 'SP', 'RJ'];
    expect(groupOf(vals, 'uf')).not.toBe('numeric');
  });

  it('texto livre continua dimension', () => {
    const vals = ['Sudeste', 'Sul', 'Nordeste', 'Norte', 'Centro-Oeste'];
    expect(col(vals, 'regiao').type).toBe('dimension');
  });

  it('preço BR não é confundido com latitude (geo_lat)', () => {
    const vals = ['1.403,70', '2.109,11', '4.240,42', '1.999,99'];
    const r = col(vals, 'preco');
    expect(r.type).not.toBe('geo_lat');
    expect(r.type).not.toBe('geo_lng');
  });
});

describe('SolsticeTypes.inferColumn — regressões da varredura com CSVs diversos', () => {
  it('código "ACC-1234" NÃO é temporal (new Date leniente do V8)', () => {
    const vals = ['ACC-1234', 'ACC-9999', 'ACC-4500', 'ACC-1000', 'ACC-7777', 'ACC-2024'];
    expect(groupOf(vals, 'account')).not.toBe('temporal');
  });

  it('"0,123" (vírgula + 3 dígitos) é decimal BR, não inteiro US', () => {
    const vals = ['0,123', '0,456', '0,789', '0,234', '0,567', '0,891', '0,345', '0,678'];
    expect(col(vals, 'taxa').type).toBe('decimal');
  });

  it('US agrupado real (2+ grupos) continua numérico', () => {
    const vals = ['1,234,567', '2,345,678', '3,456,789', '987,654'];
    expect(groupOf(vals, 'big')).toBe('numeric');
  });

  it('data ISO real continua temporal', () => {
    const vals = ['2024-01-15', '2024-03-22', '2024-07-08', '2024-11-30'];
    expect(groupOf(vals, 'date')).toBe('temporal');
  });
});

describe('SolsticeTypes.inferColumn — robustez com dados diversos (2026.6 p4-6)', () => {
  it('categórico curto repetido ("West"/"East") é dimension, não identifier', () => {
    const vals = ['West', 'East', 'South', 'North', 'West', 'East', 'South', 'North'];
    expect(col(vals, 'region').type).toBe('dimension');
  });

  it('identificador quase-único continua identifier', () => {
    const vals = ['ORD-100001','ORD-100002','ORD-100003','ORD-100004','ORD-100005','ORD-100006'];
    expect(col(vals, 'order_id').type).toBe('identifier');
  });

  it('razão 0–1 com ponto ("0.50") sem nome geo é numérica, não geo_lat', () => {
    const vals = ['0.50','0.32','0.78','0.91','0.12','0.45','0.67','0.23','0.88','0.05'];
    expect(groupOf(vals, 'profit_margin')).toBe('numeric');
    expect(col(vals, 'profit_margin').type).not.toBe('geo_lat');
  });

  it('coluna de datas dd/mm não é sobrescrita por inferência de nome ("mes")', () => {
    const vals = ['01/02/2025','15/03/2025','22/06/2025','30/09/2025','11/11/2025','05/01/2025','18/07/2025','27/12/2025'];
    expect(groupOf(vals, 'mes')).toBe('temporal');
  });

  it('latitude/longitude desambiguadas pelo nome', () => {
    const lat = ['-23.5505','-22.9068','-3.1190','-15.7942','-30.0346','-8.0476','-19.9167','-12.9714'];
    const lng = ['-46.6333','-43.1729','-60.0217','-47.8822','-51.2177','-34.8770','-43.9345','-38.5014'];
    expect(col(lat, 'latitude').type).toBe('geo_lat');
    expect(col(lng, 'longitude').type).toBe('geo_lng');
  });
});
