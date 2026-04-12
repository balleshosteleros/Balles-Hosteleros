/**
 * Productos de venta (platos) extraídos del PDF "BASE DE DATOS - Productos de Venta.pdf".
 * Los IDs corresponden a los códigos de Ágora POS.
 */

interface ProductoVentaSeed {
  agoraId: string;
  nombre: string;
  categoria: string;
}

export const PRODUCTOS_VENTA_SEED: ProductoVentaSeed[] = [
  // Para empezar
  { agoraId: "1833", nombre: "Ensaladilla Rusa", categoria: "Para empezar" },
  { agoraId: "1834", nombre: "Ensalada de Burrata", categoria: "Para empezar" },
  { agoraId: "1838", nombre: "Croquetas Jamon Iberico", categoria: "Para empezar" },
  { agoraId: "1839", nombre: "Tortilla trufada huevo", categoria: "Para empezar" },
  { agoraId: "1884", nombre: "Croquetas Carabineros", categoria: "Para empezar" },
  { agoraId: "1909", nombre: "Servicio Pan", categoria: "Para empezar" },
  { agoraId: "1916", nombre: "Croquetas Mixtas", categoria: "Para empezar" },
  { agoraId: "1919", nombre: "Croquetas", categoria: "Para empezar" },
  { agoraId: "2020", nombre: "Huevos rotos con jamon iberico", categoria: "Para empezar" },
  { agoraId: "2116", nombre: "Ud. Extra Croqueta Jamon", categoria: "Para empezar" },
  { agoraId: "2264", nombre: "Ensalada Cesar", categoria: "Para empezar" },
  { agoraId: "2270", nombre: "Provolone con pesto", categoria: "Para empezar" },
  { agoraId: "2379", nombre: "Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico", categoria: "Para empezar" },
  { agoraId: "2423", nombre: "Huevos rotos con setas", categoria: "Para empezar" },
  { agoraId: "2424", nombre: "Ensalada de Tomate y Ventresca", categoria: "Para empezar" },
  { agoraId: "2425", nombre: "Torreznos con guacamole y pico de gallo", categoria: "Para empezar" },
  { agoraId: "2460", nombre: "Ud. Extra Croqueta Carabinero", categoria: "Para empezar" },
  // De la tierra
  { agoraId: "1848", nombre: "Gyozas pollo al curry", categoria: "De la tierra" },
  { agoraId: "1849", nombre: "Brioche meloso de ternera", categoria: "De la tierra" },
  { agoraId: "1850", nombre: "Bao-cadillo de oreja a baja temperatura con brava y lima", categoria: "De la tierra" },
  { agoraId: "1914", nombre: "Ud. Extra Bao-cadillo", categoria: "De la tierra" },
  { agoraId: "1915", nombre: "Ud. Extra Brioche Ternera", categoria: "De la tierra" },
  { agoraId: "2022", nombre: "Entraña con chimichurri y guarnicion", categoria: "De la tierra" },
  { agoraId: "2179", nombre: "Cachopo con Jamon y Queso curado", categoria: "De la tierra" },
  { agoraId: "2266", nombre: "Costillas a baja temperatura", categoria: "De la tierra" },
  { agoraId: "2543", nombre: "Burger Balles Hosteleros", categoria: "De la tierra" },
  { agoraId: "2544", nombre: "Burger Bacanal 2.0", categoria: "De la tierra" },
  { agoraId: "2573", nombre: "Entrecot Lomo bajo frisona", categoria: "De la tierra" },
  // Para veganos
  { agoraId: "2157", nombre: "Gyozas Vegetales", categoria: "Para veganos" },
  { agoraId: "2574", nombre: "Alcachofas con Guacamole y Ají Amarillo", categoria: "Para veganos" },
  { agoraId: "2575", nombre: "Coliflor con barbacoa asiatica y salsa ranchera", categoria: "Para veganos" },
  // De la mar
  { agoraId: "1840", nombre: "Vieira del Pacifico", categoria: "De la mar" },
  { agoraId: "1911", nombre: "Ud. Extra Vieira", categoria: "De la mar" },
  { agoraId: "2278", nombre: "Cazon en adobo y una base de lechuga y wakame", categoria: "De la mar" },
  { agoraId: "2422", nombre: "Mejillones al curry rojo", categoria: "De la mar" },
  // Arroces
  { agoraId: "2027", nombre: "Arroz con pollo", categoria: "Arroces" },
  { agoraId: "2028", nombre: "Arroz con marisco", categoria: "Arroces" },
  { agoraId: "2030", nombre: "Arroz negro con calamares", categoria: "Arroces" },
  { agoraId: "2271", nombre: "Falso risotto con setas", categoria: "Arroces" },
  { agoraId: "2540", nombre: "Ud. Extra Arroz con pollo", categoria: "Arroces" },
  { agoraId: "2541", nombre: "Ud. Extra Arroz con marisco", categoria: "Arroces" },
  { agoraId: "2542", nombre: "Ud. Extra Arroz negro con calamares", categoria: "Arroces" },
  // Para niños
  { agoraId: "2545", nombre: "Huevos rotos con jamon iberico y patatas", categoria: "Para niños" },
  { agoraId: "2546", nombre: "Fingers de pollo con patatas", categoria: "Para niños" },
  // Momentos dulces
  { agoraId: "1854", nombre: "Tarta de queso", categoria: "Momentos dulces" },
  { agoraId: "1997", nombre: "Coulant de Chocolate", categoria: "Momentos dulces" },
  { agoraId: "2272", nombre: "Tiramisu", categoria: "Momentos dulces" },
  { agoraId: "2427", nombre: "Torrijas con helado de vainilla", categoria: "Momentos dulces" },
];
