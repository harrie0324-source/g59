// Built from the documented FoodData Central (v1 /foods/search) and Open Food Facts (v2 product)
// response shapes. Not captured live: this environment can't reach either API.

export const usdaSearch = {
  totalHits: 3,
  foods: [
    {
      fdcId: 2346401,
      description: 'GREEK NONFAT YOGURT, PLAIN',
      dataType: 'Branded',
      gtinUpc: '818290014191',
      brandOwner: 'Chobani, LLC',
      brandName: 'CHOBANI',
      servingSizeUnit: 'g',
      servingSize: 150,
      householdServingFullText: '1 container',
      foodNutrients: [
        { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'G', value: 10 },
        { nutrientId: 1004, nutrientName: 'Total lipid (fat)', nutrientNumber: '204', unitName: 'G', value: 0 },
        { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', nutrientNumber: '205', unitName: 'G', value: 4 },
        { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'KCAL', value: 53 },
        { nutrientId: 1093, nutrientName: 'Sodium, Na', nutrientNumber: '307', unitName: 'MG', value: 40 },
      ],
      foodMeasures: [],
    },
    {
      fdcId: 171304,
      description: 'Yogurt, Greek, plain, nonfat',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 59 },
        { nutrientId: 1062, nutrientNumber: '268', unitName: 'kJ', value: 247 },
        { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 10.2 },
        { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 0.39 },
        { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 3.6 },
      ],
      foodMeasures: [
        { disseminationText: '1 container (6 oz)', gramWeight: 170 },
        { disseminationText: '1 cup', gramWeight: 245 },
        { disseminationText: '', gramWeight: 28 },
      ],
    },
    {
      fdcId: 999,
      description: 'Mystery food without energy',
      dataType: 'Foundation',
      foodNutrients: [{ nutrientId: 1003, unitName: 'G', value: 5 }],
    },
    {
      fdcId: 2000,
      description: 'Oats, rolled',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrientId: 2047, nutrientNumber: '957', unitName: 'KCAL', value: 379 },
        { nutrientId: 1003, unitName: 'G', value: 13.2 },
        { nutrientId: 1079, unitName: 'G', value: 10.1 },
      ],
    },
  ],
};

export const offProduct = {
  code: '3017620422003',
  status: 1,
  status_verbose: 'product found',
  product: {
    code: '3017620422003',
    product_name: 'Nutella',
    brands: 'Ferrero, Nutella',
    serving_size: '15 g',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      energy_100g: 2252,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      fiber_100g: 0,
    },
  },
};

export const offNotFound = { code: '0000000000000', status: 0, status_verbose: 'product not found' };
