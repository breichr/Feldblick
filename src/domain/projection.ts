import proj4 from 'proj4';

proj4.defs(
  'EPSG:31287',
  '+proj=lcc +lat_0=47.5 +lon_0=13.3333333333333 +lat_1=49 +lat_2=46 ' +
    '+x_0=400000 +y_0=400000 +ellps=bessel ' +
    '+towgs84=577.326,90.129,463.919,5.137,1.474,5.297,2.4232 +units=m +no_defs +type=crs',
);

const converter = proj4('EPSG:31287', 'EPSG:4326');

/** MGI / Austria Lambert (x, y in m) -> WGS84 [lon, lat], rounded to ~1 cm. */
export function lambertToWgs84(x: number, y: number): [number, number] {
  const [lon, lat] = converter.forward([x, y]) as [number, number];
  return [round(lon), round(lat)];
}

function round(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}
