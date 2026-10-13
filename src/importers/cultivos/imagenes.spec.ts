import { describe, expect, it } from 'vitest';
import { imageSizes, pickImages } from './imagenes.js';

const photo = (id: number, license: string, creator?: string) => ({
  key: id,
  countryCode: 'CO',
  media: [
    {
      type: 'StillImage',
      identifier: `https://inaturalist-open-data.s3.amazonaws.com/photos/${id}/original.jpeg`,
      references: `https://www.inaturalist.org/photos/${id}`,
      license,
      creator,
    },
  ],
});
const BY = 'http://creativecommons.org/licenses/by/4.0/';

describe('imageSizes', () => {
  it('usa los tamaños large y medium de iNaturalist', () => {
    expect(
      imageSizes(
        'https://inaturalist-open-data.s3.amazonaws.com/photos/9/original.png',
      ),
    ).toEqual({
      url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/9/large.png',
      thumbnailUrl:
        'https://inaturalist-open-data.s3.amazonaws.com/photos/9/medium.png',
    });
  });
  it('conserva la extensión del original (.jpeg, .png)', () => {
    const base = 'https://inaturalist-open-data.s3.amazonaws.com/photos/9/';
    expect(imageSizes(`${base}original.jpeg`).url).toBe(`${base}large.jpeg`);
    expect(imageSizes(`${base}original.png`).thumbnailUrl).toBe(
      `${base}medium.png`,
    );
  });
  it('deja intactas las demás fuentes', () => {
    expect(imageSizes('https://example.org/a.jpg')).toEqual({
      url: 'https://example.org/a.jpg',
      thumbnailUrl: null,
    });
  });
});

describe('pickImages', () => {
  it('descarta licencias no abiertas aunque el registro sea abierto', () => {
    const result = pickImages(
      [
        photo(1, 'http://creativecommons.org/licenses/by-nd/4.0/', 'ana'),
        photo(2, 'http://creativecommons.org/licenses/by-nc-sa/4.0/', 'ben'),
        photo(3, 'http://creativecommons.org/licenses/by-nc/4.0/', 'cris'),
        photo(4, BY, 'dora'),
        photo(5, 'http://creativecommons.org/publicdomain/zero/1.0/', 'eli'),
      ],
      10,
    );
    expect(result.map((r) => r.license)).toEqual(['CC-BY-4.0', 'CC0-1.0']);
  });
  it('exige autoría', () => {
    expect(
      pickImages([photo(1, BY, undefined), photo(2, BY, '  ')], 5),
    ).toEqual([]);
  });
  it('rechaza http sin cifrar', () => {
    const insecure = photo(1, BY, 'ana');
    insecure.media[0].identifier = 'http://example.org/a.jpg';
    expect(pickImages([insecure], 5)).toEqual([]);
  });
  it('prefiere autores distintos y respeta el máximo', () => {
    const result = pickImages(
      [photo(1, BY, 'ana'), photo(2, BY, 'ana'), photo(3, BY, 'ben')],
      2,
    );
    expect(result.map((r) => r.author)).toEqual(['ana', 'ben']);
  });
  it('no repite imágenes', () => {
    expect(
      pickImages([photo(1, BY, 'ana'), photo(1, BY, 'ana')], 5),
    ).toHaveLength(1);
  });
});
