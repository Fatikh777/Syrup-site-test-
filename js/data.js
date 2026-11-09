/* Barcode Syrup — данные сайта */
window.BS = (function () {
  var PHONE = "996507508636";
  var PHONE_VIEW = "+996 507 508 636";

  function wa(text) {
    return "https://wa.me/" + PHONE + "?text=" + encodeURIComponent(text);
  }

  // Пять вкусов первого экрана: цвета жидкости и фона
  var STORY = [
    {
      id: "mango", ru: "Манго", en: "Mango", num: "01",
      liquid: "#ffc21a", bgIn: "#f59e0b", bgOut: "#5a1e06",
      text: "Спелое манго с мягкой сладостью. Солнечный лимонад за минуту или яркий раф.",
      fits: ["лимонад", "раф", "смузи"]
    },
    {
      id: "strawberry", ru: "Клубника", en: "Strawberry", num: "02",
      liquid: "#ff2d55", bgIn: "#e11d48", bgOut: "#3d0412",
      text: "Сочная летняя клубника. Для молочных коктейлей, матчи и ягодной содовой.",
      fits: ["милкшейк", "матча", "содовая"]
    },
    {
      id: "mojito", ru: "Мохито", en: "Mojito", num: "03",
      liquid: "#a3e635", bgIn: "#0ea86f", bgOut: "#022019",
      text: "Мята и лайм без капли алкоголя. Освежает лучше любого кондиционера.",
      fits: ["лимонад", "тоник", "коктейль"]
    },
    {
      id: "caramel", ru: "Карамель", en: "Caramel", num: "04",
      liquid: "#e08a2c", bgIn: "#b45309", bgOut: "#1f0e04",
      text: "Густая сливочная карамель. Классика для латте, капучино и холодного кофе.",
      fits: ["латте", "капучино", "айс-кофе"]
    },
    {
      id: "passion", ru: "Маракуйя", en: "Passion Fruit", num: "05",
      liquid: "#ffb320", bgIn: "#8b2bd9", bgOut: "#16042b",
      text: "Тропическая кислинка маракуйи. Делает лимонад и чай по-настоящему яркими.",
      fits: ["лимонад", "чай", "коктейль"]
    }
  ];

  var CATS = [
    { id: "all", ru: "Все" },
    { id: "fruit", ru: "Фрукты" },
    { id: "berry", ru: "Ягоды" },
    { id: "dessert", ru: "Десертные" },
    { id: "fresh", ru: "Свежие" }
  ];

  var FITS = {
    fruit: ["лимонад", "коктейль"],
    berry: ["лимонад", "милкшейк"],
    dessert: ["кофе", "какао"],
    fresh: ["лимонад", "коктейль"]
  };

  // [номер, название на этикетке, по-русски, категория, цвет]
  var FLAVORS = [
    [1, "Mango", "Манго", "fruit", "#f5a31a"],
    [2, "Passion Fruit", "Маракуйя", "fruit", "#d9822b"],
    [3, "Caramel", "Карамель", "dessert", "#c07a2c"],
    [4, "Salted Caramel", "Солёная карамель", "dessert", "#a8672a"],
    [5, "Chocolate", "Шоколад", "dessert", "#7a4128"],
    [6, "Vanilla", "Ваниль", "dessert", "#e8d3a2"],
    [7, "Mango-Passion Fruit", "Манго-маракуйя", "fruit", "#e8892a"],
    [8, "Forest Berries", "Лесные ягоды", "berry", "#9a2f66"],
    [9, "Pineapple", "Ананас", "fruit", "#f0c93a"],
    [10, "Orange", "Апельсин", "fruit", "#f28a1e"],
    [11, "Melon", "Дыня", "fruit", "#c9d77a"],
    [12, "Mojito", "Мохито", "fresh", "#7dbe5a"],
    [13, "Cherry", "Вишня", "berry", "#c0243f"],
    [14, "Raspberry", "Малина", "berry", "#d61f69"],
    [15, "Strawberry", "Клубника", "berry", "#e8263f"],
    [16, "Pomegranate", "Гранат", "fruit", "#c22437"],
    [17, "Mint", "Мята", "fresh", "#5cc6a0"],
    [18, "Almond", "Миндаль", "dessert", "#d9b48a"],
    [19, "Blueberry", "Черника", "berry", "#5b60c4"],
    [20, "Hazelnut", "Лесной орех", "dessert", "#a06a40"],
    [21, "Lime", "Лайм", "fresh", "#8fcb3e"],
    [22, "Watermelon", "Арбуз", "fruit", "#ef5a70"],
    [23, "Green Apple", "Зелёное яблоко", "fruit", "#9ccb3b"],
    [24, "Blue Curacao", "Блю Кюрасао", "fresh", "#1e90d6"],
    [25, "Banana", "Банан", "fruit", "#f2d55b"],
    [26, "Apricot", "Абрикос", "fruit", "#f4a950"],
    [27, "Black Currant", "Чёрная смородина", "berry", "#7a3482"],
    [28, "Cranberry", "Клюква", "berry", "#c9284a"],
    [29, "Coconut", "Кокос", "dessert", "#efe6d6"],
    [30, "Blackberry", "Ежевика", "berry", "#6a4a9c"],
    [31, "Peach", "Персик", "fruit", "#f58c5a"],
    [32, "Pear", "Груша", "fruit", "#c8d36b"],
    [33, "Kiwi", "Киви", "fruit", "#7fb432"]
  ].map(function (f) {
    var fits = FITS[f[3]].slice();
    if (f[1] === "Coconut") fits = ["кофе", "коктейль"];
    if (f[1] === "Mint") fits = ["кофе", "лимонад"];
    return { n: f[0], en: f[1], ru: f[2], cat: f[3], c: f[4], fits: fits };
  });

  var RECIPES = [
    { name: "Латте с солёной карамелью", how: "20 мл Salted Caramel, двойной эспрессо, 200 мл молока", syrup: "#a8672a", drink: "#d9b48f", top: "#f3e6d4", ice: false },
    { name: "Манго-маракуйя лимонад", how: "30 мл Mango-Passion Fruit, сок лайма, содовая, лёд", syrup: "#e8892a", drink: "#ffc44d", top: "#fff3c4", ice: true },
    { name: "Мохито без алкоголя", how: "30 мл Mojito, листья мяты, лайм, содовая, лёд", syrup: "#5fae3c", drink: "#c4ec8c", top: "#ecffd6", ice: true },
    { name: "Ягодная содовая", how: "15 мл Strawberry, 15 мл Raspberry, содовая, лёд", syrup: "#c2185b", drink: "#ff6f91", top: "#ffd0dc", ice: true },
    { name: "Голубая лагуна", how: "20 мл Blue Curacao, 10 мл Lime, тоник, лёд", syrup: "#1673b8", drink: "#4fc3f7", top: "#d4f3ff", ice: true },
    { name: "Кокосовый колд-брю", how: "20 мл Coconut, 150 мл колд-брю, лёд", syrup: "#5a3a22", drink: "#8a5a3a", top: "#efe6d6", ice: true }
  ];

  return {
    PHONE: PHONE, PHONE_VIEW: PHONE_VIEW, wa: wa,
    STORY: STORY, CATS: CATS, FLAVORS: FLAVORS, RECIPES: RECIPES
  };
})();
