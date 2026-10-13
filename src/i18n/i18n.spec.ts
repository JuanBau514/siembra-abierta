import { LABELS, resolveLang } from './i18n.js';

describe('resolveLang', () => {
  it('usa español por defecto', () => {
    expect(resolveLang()).toBe('es');
    expect(resolveLang('fr-FR,de;q=0.8')).toBe('es');
  });
  it('lee Accept-Language respetando q', () => {
    expect(resolveLang('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(resolveLang('es;q=0.5,en;q=0.9')).toBe('en');
  });
  it('el parámetro ?lang= tiene prioridad', () => {
    expect(resolveLang('en-US', 'es')).toBe('es');
    expect(resolveLang('es', 'EN')).toBe('en');
  });
  it('ignora un ?lang= no admitido', () => {
    expect(resolveLang('en', 'xx')).toBe('en');
  });
});

describe('LABELS', () => {
  it('todos los idiomas tienen los mismos valores', () => {
    expect(Object.keys(LABELS.es.origin)).toEqual(
      Object.keys(LABELS.en.origin),
    );
    expect(Object.keys(LABELS.es.risk)).toEqual(Object.keys(LABELS.en.risk));
    expect(Object.keys(LABELS.es.verification)).toEqual(
      Object.keys(LABELS.en.verification),
    );
  });
});
