/*!
 * 532 碳降 · 核心逻辑
 * 无 DOM、无网络依赖：浏览器 <script> / Node require / 微信小程序 require 都能直接用。
 *
 * 方法（作者原版）：
 *   1. 热量 = 基础代谢 + 训练消耗（体重 × 5 / 8 / 10），首周按总消耗吃
 *   2. 营养素 5:3:2（碳水 50% / 蛋白 30% / 脂肪 20%）
 *   3. 目标：每月减 3% 体重 ≈ 每周 -0.75%
 *   4. 每周第 7 天称重：达标不动；未达标等 3 天，再降 15–30 g 碳水
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Carb532 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;
  var KCAL = { carb: 4, protein: 4, fat: 9 };
  var FAT_KCAL_PER_KG = 7700;

  /* 训练消耗系数：体重(kg) × factor = 每日训练消耗(kcal) */
  var ACTIVITY = {
    novice: { key: 'novice', label: '新手 / 女生', factor: 5, hint: '刚起步，或每周 2–3 次' },
    hobby: { key: 'hobby', label: '普通爱好者', factor: 8, hint: '每周 3–5 次，训练有强度' },
    high: { key: 'high', label: '高强度', factor: 10, hint: '每周 5 次以上 / 体力劳动' }
  };
  var ACTIVITY_LIST = [ACTIVITY.novice, ACTIVITY.hobby, ACTIVITY.high];

  /* 常见食物，数值为每 100 g 的近似值（参考中国食物成分表与美国农业部数据库） */
  var FOODS = [
    /* 主食 */
    { g: 'staple', id: 'rice', name: '米饭（熟）', carb: 25.9, protein: 2.6, fat: 0.3, portion: 150, alt: '白饭 大米饭 白米饭' },
    { g: 'staple', id: 'brownrice', name: '糙米饭（熟）', carb: 23.0, protein: 2.8, fat: 0.9, portion: 150, alt: '杂粮饭 糙米' },
    { g: 'staple', id: 'congee', name: '白粥', carb: 9.9, protein: 1.1, fat: 0.3, portion: 250, alt: '稀饭 粥 米粥' },
    { g: 'staple', id: 'noodle', name: '面条（熟）', carb: 24.9, protein: 4.5, fat: 0.5, portion: 150, alt: '面 拉面 挂面 汤面' },
    { g: 'staple', id: 'ricenoodle', name: '米粉（熟）', carb: 25.0, protein: 1.6, fat: 0.2, portion: 150, alt: '米线 河粉 粉' },
    { g: 'staple', id: 'buckwheat', name: '荞麦面（熟）', carb: 21.0, protein: 4.8, fat: 0.5, portion: 150, alt: '荞麦 冷面' },
    { g: 'staple', id: 'mantou', name: '馒头', carb: 47.0, protein: 7.0, fat: 1.1, portion: 100, alt: '白馒头 馍' },
    { g: 'staple', id: 'baozi', name: '肉包子', carb: 30.0, protein: 7.0, fat: 5.0, portion: 100, alt: '包子 肉包' },
    { g: 'staple', id: 'dumpling', name: '猪肉饺子', carb: 25.0, protein: 7.0, fat: 5.0, portion: 200, alt: '水饺 饺子 锅贴' },
    { g: 'staple', id: 'bread', name: '全麦面包', carb: 43.0, protein: 9.0, fat: 3.4, portion: 80, alt: '面包 吐司' },
    { g: 'staple', id: 'toast', name: '白吐司', carb: 50.0, protein: 8.0, fat: 3.5, portion: 60, alt: '吐司 白面包' },
    { g: 'staple', id: 'oats', name: '燕麦片（干）', carb: 66.0, protein: 15.0, fat: 7.0, portion: 50, alt: '燕麦 麦片' },
    { g: 'staple', id: 'corn', name: '玉米（煮）', carb: 22.8, protein: 4.0, fat: 1.2, portion: 150, alt: '玉米 甜玉米 棒子' },
    { g: 'staple', id: 'sweetpot', name: '红薯', carb: 20.1, protein: 1.6, fat: 0.2, portion: 200, alt: '地瓜 番薯 红苕' },
    { g: 'staple', id: 'potato', name: '土豆', carb: 17.2, protein: 2.0, fat: 0.2, portion: 200, alt: '马铃薯 洋芋' },
    { g: 'staple', id: 'taro', name: '芋头', carb: 18.0, protein: 2.2, fat: 0.2, portion: 150, alt: '芋艿 香芋' },
    { g: 'staple', id: 'yam', name: '山药', carb: 12.4, protein: 1.9, fat: 0.2, portion: 150, alt: '淮山' },
    { g: 'staple', id: 'pasta', name: '意面（干）', carb: 75.0, protein: 12.0, fat: 1.5, portion: 80, alt: '意大利面 通心粉' },
    { g: 'staple', id: 'quinoa', name: '藜麦（熟）', carb: 21.3, protein: 4.4, fat: 1.9, portion: 150, alt: '藜麦 奎奴亚' },
    { g: 'staple', id: 'ricecake', name: '年糕', carb: 35.0, protein: 3.0, fat: 0.5, portion: 100, alt: '年糕 江米' },

    /* 蛋白 */
    { g: 'protein', id: 'chicken', name: '鸡胸肉', carb: 0.0, protein: 31.0, fat: 3.6, portion: 150, alt: '鸡胸 鸡肉 鸡脯' },
    { g: 'protein', id: 'chickenthigh', name: '鸡腿肉（去皮）', carb: 0.0, protein: 19.0, fat: 9.0, portion: 150, alt: '鸡腿 琵琶腿' },
    { g: 'protein', id: 'egg', name: '鸡蛋', carb: 0.7, protein: 13.0, fat: 9.0, portion: 50, alt: '蛋 水煮蛋 煎蛋' },
    { g: 'protein', id: 'eggwhite', name: '蛋清', carb: 0.0, protein: 11.0, fat: 0.2, portion: 60, alt: '蛋白 鸡蛋清' },
    { g: 'protein', id: 'beef', name: '牛肉（瘦）', carb: 0.0, protein: 26.0, fat: 8.0, portion: 150, alt: '牛里脊 牛肉' },
    { g: 'protein', id: 'beefmince', name: '牛肉馅', carb: 0.0, protein: 19.0, fat: 13.0, portion: 120, alt: '牛肉末 牛肉饼' },
    { g: 'protein', id: 'pork', name: '猪里脊', carb: 0.0, protein: 29.0, fat: 6.0, portion: 150, alt: '猪肉 瘦肉 里脊' },
    { g: 'protein', id: 'porkbelly', name: '五花肉', carb: 0.0, protein: 9.0, fat: 37.0, portion: 80, alt: '肥肉 三层肉' },
    { g: 'protein', id: 'lamb', name: '羊肉（瘦）', carb: 0.0, protein: 25.0, fat: 8.0, portion: 150, alt: '羊肉 羊腿' },
    { g: 'protein', id: 'duck', name: '鸭肉', carb: 0.0, protein: 19.0, fat: 18.0, portion: 120, alt: '鸭 烤鸭' },
    { g: 'protein', id: 'salmon', name: '三文鱼', carb: 0.0, protein: 20.0, fat: 13.0, portion: 120, alt: '鲑鱼 三文鱼排' },
    { g: 'protein', id: 'cod', name: '鳕鱼', carb: 0.0, protein: 20.0, fat: 0.5, portion: 150, alt: '白鱼 鳕鱼排' },
    { g: 'protein', id: 'shrimp', name: '虾', carb: 0.0, protein: 18.0, fat: 0.8, portion: 150, alt: '虾仁 基围虾 白虾' },
    { g: 'protein', id: 'tuna', name: '金枪鱼（水浸）', carb: 0.0, protein: 24.0, fat: 1.0, portion: 100, alt: '吞拿鱼 罐头金枪鱼' },
    { g: 'protein', id: 'ham', name: '火腿', carb: 1.0, protein: 16.0, fat: 8.0, portion: 50, alt: '火腿片 午餐肉' },
    { g: 'protein', id: 'sausage', name: '香肠', carb: 3.0, protein: 14.0, fat: 25.0, portion: 60, alt: '腊肠 热狗肠' },
    { g: 'protein', id: 'beefjerky', name: '牛肉干', carb: 10.0, protein: 45.0, fat: 10.0, portion: 40, alt: '牛干巴 风干牛肉' },
    { g: 'protein', id: 'fishball', name: '鱼丸', carb: 12.0, protein: 10.0, fat: 3.0, portion: 100, alt: '鱼蛋 墨鱼丸' },
    { g: 'protein', id: 'tofu', name: '豆腐（嫩）', carb: 2.0, protein: 8.0, fat: 4.0, portion: 200, alt: '南豆腐 豆花' },
    { g: 'protein', id: 'tofufirm', name: '北豆腐', carb: 3.0, protein: 12.0, fat: 6.0, portion: 150, alt: '老豆腐 板豆腐' },
    { g: 'protein', id: 'tofudry', name: '豆干', carb: 6.0, protein: 16.0, fat: 7.0, portion: 100, alt: '香干 豆腐干' },
    { g: 'protein', id: 'yuba', name: '腐竹（干）', carb: 22.0, protein: 44.0, fat: 21.0, portion: 30, alt: '腐竹 豆皮' },
    { g: 'protein', id: 'soymilk', name: '无糖豆浆', carb: 3.0, protein: 3.0, fat: 1.6, portion: 300, alt: '豆浆 豆奶' },

    /* 蔬菜 */
    { g: 'veg', id: 'broccoli', name: '西兰花', carb: 4.3, protein: 4.1, fat: 0.6, portion: 200, alt: '西蓝花 绿花菜' },
    { g: 'veg', id: 'spinach', name: '菠菜', carb: 4.5, protein: 2.6, fat: 0.3, portion: 200, alt: '菠菜' },
    { g: 'veg', id: 'lettuce', name: '生菜', carb: 2.9, protein: 1.3, fat: 0.3, portion: 150, alt: '生菜 油麦菜' },
    { g: 'veg', id: 'cabbage', name: '大白菜', carb: 3.2, protein: 1.5, fat: 0.1, portion: 200, alt: '白菜 娃娃菜' },
    { g: 'veg', id: 'tomato', name: '番茄', carb: 4.0, protein: 0.9, fat: 0.2, portion: 200, alt: '西红柿 圣女果' },
    { g: 'veg', id: 'cucumber', name: '黄瓜', carb: 2.9, protein: 0.8, fat: 0.2, portion: 200, alt: '青瓜' },
    { g: 'veg', id: 'carrot', name: '胡萝卜', carb: 8.8, protein: 1.0, fat: 0.2, portion: 100, alt: '红萝卜 甘笋' },
    { g: 'veg', id: 'eggplant', name: '茄子', carb: 4.9, protein: 1.1, fat: 0.2, portion: 200, alt: '矮瓜' },
    { g: 'veg', id: 'pepper', name: '青椒', carb: 5.4, protein: 1.0, fat: 0.2, portion: 100, alt: '柿子椒 彩椒' },
    { g: 'veg', id: 'mushroom', name: '香菇', carb: 4.1, protein: 2.7, fat: 0.1, portion: 150, alt: '蘑菇 冬菇' },
    { g: 'veg', id: 'woodear', name: '木耳（水发）', carb: 6.0, protein: 1.5, fat: 0.2, portion: 100, alt: '黑木耳 云耳' },
    { g: 'veg', id: 'kelp', name: '海带', carb: 2.1, protein: 1.2, fat: 0.1, portion: 100, alt: '海带丝 昆布' },
    { g: 'veg', id: 'sprout', name: '豆芽', carb: 2.6, protein: 2.1, fat: 0.1, portion: 150, alt: '绿豆芽 黄豆芽' },
    { g: 'veg', id: 'lotusroot', name: '莲藕', carb: 16.0, protein: 1.9, fat: 0.2, portion: 150, alt: '藕 莲菜' },
    { g: 'veg', id: 'pumpkin', name: '南瓜', carb: 5.3, protein: 0.7, fat: 0.1, portion: 200, alt: '倭瓜 金瓜' },

    /* 水果 */
    { g: 'fruit', id: 'banana', name: '香蕉', carb: 22.0, protein: 1.4, fat: 0.2, portion: 120, alt: '蕉' },
    { g: 'fruit', id: 'apple', name: '苹果', carb: 13.5, protein: 0.3, fat: 0.2, portion: 200, alt: '苹果' },
    { g: 'fruit', id: 'orange', name: '橙子', carb: 11.0, protein: 0.8, fat: 0.2, portion: 200, alt: '橘子 柑橘 柚子' },
    { g: 'fruit', id: 'grape', name: '葡萄', carb: 10.3, protein: 0.5, fat: 0.2, portion: 150, alt: '提子 巨峰' },
    { g: 'fruit', id: 'watermelon', name: '西瓜', carb: 6.8, protein: 0.6, fat: 0.1, portion: 300, alt: '瓜' },
    { g: 'fruit', id: 'strawberry', name: '草莓', carb: 7.1, protein: 1.0, fat: 0.2, portion: 150, alt: '士多啤梨' },
    { g: 'fruit', id: 'blueberry', name: '蓝莓', carb: 14.5, protein: 0.7, fat: 0.3, portion: 100, alt: '蓝莓' },
    { g: 'fruit', id: 'kiwi', name: '猕猴桃', carb: 14.5, protein: 1.1, fat: 0.5, portion: 100, alt: '奇异果' },
    { g: 'fruit', id: 'pear', name: '梨', carb: 13.3, protein: 0.4, fat: 0.2, portion: 200, alt: '雪梨 鸭梨' },
    { g: 'fruit', id: 'peach', name: '桃', carb: 12.2, protein: 0.9, fat: 0.1, portion: 200, alt: '水蜜桃 桃子' },
    { g: 'fruit', id: 'dragonfruit', name: '火龙果', carb: 13.3, protein: 1.1, fat: 0.2, portion: 200, alt: '红心火龙果' },
    { g: 'fruit', id: 'mango', name: '芒果', carb: 15.0, protein: 0.6, fat: 0.2, portion: 200, alt: '芒果' },
    { g: 'fruit', id: 'lychee', name: '荔枝', carb: 16.6, protein: 0.9, fat: 0.2, portion: 100, alt: '荔枝 桂味' },

    /* 乳制品 */
    { g: 'dairy', id: 'milk', name: '牛奶', carb: 4.8, protein: 3.3, fat: 3.6, portion: 250, alt: '纯牛奶 全脂奶' },
    { g: 'dairy', id: 'yogurt', name: '无糖酸奶', carb: 5.0, protein: 4.0, fat: 3.0, portion: 150, alt: '酸奶 原味酸奶' },
    { g: 'dairy', id: 'greekyogurt', name: '希腊酸奶', carb: 3.6, protein: 10.0, fat: 0.4, portion: 150, alt: '希腊式酸奶 脱乳清' },
    { g: 'dairy', id: 'cheese', name: '奶酪', carb: 1.3, protein: 25.0, fat: 33.0, portion: 20, alt: '芝士 干酪' },
    { g: 'dairy', id: 'whey', name: '乳清蛋白粉', carb: 3.0, protein: 80.0, fat: 5.0, portion: 30, alt: '蛋白粉 乳清' },

    /* 坚果油脂 */
    { g: 'fat', id: 'almond', name: '杏仁', carb: 22.0, protein: 21.0, fat: 50.0, portion: 20, alt: '扁桃仁 巴旦木' },
    { g: 'fat', id: 'peanut', name: '花生', carb: 16.0, protein: 26.0, fat: 49.0, portion: 30, alt: '花生米 落花生' },
    { g: 'fat', id: 'walnut', name: '核桃', carb: 14.0, protein: 15.0, fat: 59.0, portion: 20, alt: '核桃仁 胡桃' },
    { g: 'fat', id: 'cashew', name: '腰果', carb: 30.0, protein: 18.0, fat: 44.0, portion: 20, alt: '腰果仁 介寿果' },
    { g: 'fat', id: 'pistachio', name: '开心果', carb: 28.0, protein: 20.0, fat: 45.0, portion: 20, alt: '开心果' },
    { g: 'fat', id: 'sesame', name: '芝麻', carb: 24.0, protein: 17.0, fat: 46.0, portion: 10, alt: '白芝麻 黑芝麻' },
    { g: 'fat', id: 'oliveoil', name: '橄榄油', carb: 0.0, protein: 0.0, fat: 100.0, portion: 10, alt: '初榨橄榄油' },
    { g: 'fat', id: 'oil', name: '食用油', carb: 0.0, protein: 0.0, fat: 100.0, portion: 10, alt: '花生油 菜籽油 大豆油 猪油' },
    { g: 'fat', id: 'butter', name: '黄油', carb: 0.9, protein: 0.7, fat: 81.0, portion: 10, alt: '牛油 黄油块' },
    { g: 'fat', id: 'peanutbutter', name: '花生酱', carb: 20.0, protein: 25.0, fat: 50.0, portion: 20, alt: '花生酱 麻酱' },
    { g: 'fat', id: 'avocado', name: '牛油果', carb: 8.5, protein: 2.0, fat: 15.0, portion: 100, alt: '鳄梨 油梨' },

    /* 零食饮品 */
    { g: 'snack', id: 'cola', name: '可乐', carb: 10.6, protein: 0.0, fat: 0.0, portion: 330, alt: '可口可乐 百事 汽水' },
    { g: 'snack', id: 'colazero', name: '无糖可乐', carb: 0.0, protein: 0.0, fat: 0.0, portion: 330, alt: '零度 健怡 零糖' },
    { g: 'snack', id: 'beer', name: '啤酒', carb: 3.6, protein: 0.3, fat: 0.0, portion: 330, alt: '扎啤 生啤 精酿' },
    { g: 'snack', id: 'latte', name: '拿铁', carb: 4.5, protein: 3.2, fat: 3.2, portion: 300, alt: '咖啡 奶咖' },
    { g: 'snack', id: 'americano', name: '美式咖啡', carb: 0.5, protein: 0.1, fat: 0.0, portion: 350, alt: '黑咖啡 冰美式' },
    { g: 'snack', id: 'honey', name: '蜂蜜', carb: 75.0, protein: 0.3, fat: 0.0, portion: 15, alt: '蜜糖 蜂蜜水' },
    { g: 'snack', id: 'sugar', name: '白砂糖', carb: 100.0, protein: 0.0, fat: 0.0, portion: 10, alt: '糖 白糖 绵白糖' },
    { g: 'snack', id: 'chocolate', name: '巧克力', carb: 59.0, protein: 7.8, fat: 30.0, portion: 20, alt: '黑巧 牛奶巧克力' },
    { g: 'snack', id: 'chips', name: '薯片', carb: 52.0, protein: 6.6, fat: 33.0, portion: 40, alt: '土豆片 膨化食品' },
    { g: 'snack', id: 'cake', name: '蛋糕', carb: 50.0, protein: 6.0, fat: 15.0, portion: 80, alt: '奶油蛋糕 糕点' },
    { g: 'snack', id: 'icecream', name: '冰淇淋', carb: 24.0, protein: 3.5, fat: 11.0, portion: 80, alt: '雪糕 冰激凌' },
    { g: 'snack', id: 'burger', name: '汉堡', carb: 25.0, protein: 13.0, fat: 12.0, portion: 200, alt: '汉堡包 牛肉堡' },
    { g: 'snack', id: 'pizza', name: '披萨', carb: 30.0, protein: 11.0, fat: 10.0, portion: 120, alt: '比萨 披萨片' },
    { g: 'snack', id: 'instantnoodle', name: '方便面', carb: 60.0, protein: 9.0, fat: 17.0, portion: 100, alt: '泡面 速食面' },
    { g: 'snack', id: 'proteinbar', name: '蛋白棒', carb: 40.0, protein: 30.0, fat: 10.0, portion: 60, alt: '能量棒 代餐棒' }
  ];

  /* 食物分组，用于选择器里的分区展示 */
  var FOOD_GROUPS = [
    { key: 'staple', label: '主食' },
    { key: 'protein', label: '蛋白' },
    { key: 'veg', label: '蔬菜' },
    { key: 'fruit', label: '水果' },
    { key: 'dairy', label: '乳制品' },
    { key: 'fat', label: '坚果油脂' },
    { key: 'snack', label: '零食饮品' }
  ];

  /* ---------- 数字 ---------- */
  function round(v, d) {
    var p = Math.pow(10, d || 0);
    return Math.round((Number(v) || 0) * p) / p;
  }
  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- 日期（全部按本地时区） ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function fromKey(key) {
    var p = String(key).split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1);
  }
  function dayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function addDays(date, n) {
    var x = new Date(date.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function diffDays(a, b) {
    return Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86400000);
  }
  function todayKey() { return toKey(new Date()); }
  function addDaysKey(key, n) { return toKey(addDays(fromKey(key), n)); }
  function diffDaysKeys(a, b) { return diffDays(fromKey(a), fromKey(b)); }

  /* ---------- 热量与营养素 ---------- */
  function bmr(profile) {
    var w = toNum(profile.weight);
    var h = toNum(profile.height);
    var a = toNum(profile.age);
    var base = 10 * w + 6.25 * h - 5 * a;
    return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
  }

  function factorOf(key) {
    return (ACTIVITY[key] || ACTIVITY.hobby).factor;
  }

  /* 生成初始方案：input = {sex, age, height, weight, activity, overrideKcal} */
  function planFrom(input) {
    var b = bmr(input);
    var factor = factorOf(input.activity);
    var train = Math.round(toNum(input.weight) * factor);
    var tdee = Math.round(b + train);
    var overrideKcal = Math.round(toNum(input.overrideKcal));
    var kcal = overrideKcal > 0 ? overrideKcal : tdee;
    var pct = { carb: 50, protein: 30, fat: 20 };
    var grams = {
      carb: Math.round(kcal * pct.carb / 100 / KCAL.carb),
      protein: Math.round(kcal * pct.protein / 100 / KCAL.protein),
      fat: Math.round(kcal * pct.fat / 100 / KCAL.fat)
    };
    return {
      bmr: b, factor: factor, trainKcal: train, tdee: tdee,
      kcal: kcal, overrideKcal: overrideKcal, pct: pct, grams: grams
    };
  }

  /* 每周目标减重：每月 pct% → 每周 pct/4 % */
  function weeklyTargetKg(weight, monthPct) {
    return toNum(weight) * (toNum(monthPct, 3) / 100) / 4;
  }

  /* 当前执行方案：碳水随调整下降，蛋白 / 脂肪不变 */
  function currentTargets(plan) {
    var cut = 0;
    for (var i = 0; i < plan.adjustments.length; i++) cut += plan.adjustments[i].grams;
    var carb = Math.max(0, plan.base.carb - cut);
    var protein = plan.base.protein;
    var fat = plan.base.fat;
    return {
      carb: carb,
      protein: protein,
      fat: fat,
      /* 按"初始目标 − 已下调碳水的热量"计，与方案页的初始值保持一致 */
      kcal: Math.round(toNum(plan.kcal) - cut * KCAL.carb),
      cut: cut
    };
  }

  /* 体重变化折算热量缺口（只用于提示，不影响方案） */
  function carbCutToKcal(grams) { return Math.round(toNum(grams) * KCAL.carb); }
  function kcalToFatKg(kcalPerDay, days) {
    return round((toNum(kcalPerDay) * toNum(days, 7)) / FAT_KCAL_PER_KG, 3);
  }

  /* ---------- 状态 ---------- */
  function createState(input) {
    var today = todayKey();
    var plan = planFrom(input);
    return {
      version: VERSION,
      startDate: today,
      profile: {
        sex: input.sex === 'female' ? 'female' : 'male',
        age: toNum(input.age),
        height: toNum(input.height),
        weightStart: round(input.weight, 1),
        goalWeight: toNum(input.goalWeight) > 0 ? round(input.goalWeight, 1) : null,
        activity: ACTIVITY[input.activity] ? input.activity : 'hobby'
      },
      plan: {
        bmr: plan.bmr,
        factor: plan.factor,
        trainKcal: plan.trainKcal,
        tdee: plan.tdee,
        kcal: plan.kcal,
        overrideKcal: plan.overrideKcal,
        pct: plan.pct,
        base: plan.grams,
        monthPct: toNum(input.monthPct, 3),
        stepG: toNum(input.stepG, 15),
        adjustments: []
      },
      weights: [{ date: today, kg: round(input.weight, 1) }],
      checkins: [],
      pendings: [],
      foods: {},
      cheats: [],
      workouts: [],
      favorites: [],
      settings: { theme: 'auto' }
    };
  }

  /* ---------- 训练记录（只做记录，不参与 532 的碳水计算） ---------- */

  var WORKOUT_TYPES = [
    { key: 'strength', label: '力量' },
    { key: 'cardio', label: '有氧' },
    { key: 'ball', label: '球类' },
    { key: 'other', label: '其他' }
  ];

  function workoutLabel(key) {
    for (var i = 0; i < WORKOUT_TYPES.length; i++) {
      if (WORKOUT_TYPES[i].key === key) return WORKOUT_TYPES[i].label;
    }
    return '其他';
  }

  function addWorkout(state, input) {
    var entry = {
      id: newId(),
      date: input.date || todayKey(),
      type: WORKOUT_TYPES.some(function (t) { return t.key === input.type; }) ? input.type : 'other',
      minutes: Math.max(1, Math.round(toNum(input.minutes, 0)))
    };
    state.workouts = state.workouts || [];
    state.workouts.push(entry);
    state.workouts.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return entry;
  }

  function removeWorkout(state, id) {
    var list = state.workouts || [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    if (idx < 0) return null;
    return list.splice(idx, 1)[0];
  }

  function workoutStats(state, fromKey) {
    var list = (state.workouts || []).filter(function (w) { return w.date >= fromKey; });
    var minutes = list.reduce(function (sum, w) { return sum + w.minutes; }, 0);
    var byType = {};
    list.forEach(function (w) { byType[w.type] = (byType[w.type] || 0) + w.minutes; });
    return { count: list.length, minutes: minutes, byType: byType };
  }

  /* 最近 n 周的训练量（按 532 的周切分，含本周；无记录为 0） */
  function weeklyWorkouts(state, weeks) {
    weeks = Math.max(1, Math.round(toNum(weeks, 6)));
    var list = state.workouts || [];
    var cur = Math.max(1, Math.floor(diffDaysKeys(state.startDate, todayKey()) / 7) + 1);
    var out = [];
    for (var i = weeks - 1; i >= 0; i--) {
      var wk = cur - i;
      if (wk < 1) { out.push({ week: wk, minutes: 0, count: 0, current: false }); continue; }
      var from = addDaysKey(state.startDate, 7 * (wk - 1));
      var to = addDaysKey(state.startDate, 7 * wk - 1);
      var minutes = 0, count = 0;
      list.forEach(function (w) {
        if (w.date >= from && w.date <= to) { minutes += w.minutes; count++; }
      });
      out.push({ week: wk, from: from, to: to, minutes: minutes, count: count, current: wk === cur });
    }
    return out;
  }

  /* 收藏（置顶在食物选择器里） */
  function isFavorite(state, id) {
    return (state.favorites || []).indexOf(id) >= 0;
  }

  function toggleFavorite(state, id) {
    state.favorites = state.favorites || [];
    var i = state.favorites.indexOf(id);
    if (i >= 0) { state.favorites.splice(i, 1); return false; }
    state.favorites.push(id);
    return true;
  }

  function favoriteFoods(state) {
    var ids = state.favorites || [];
    var out = [];
    ids.forEach(function (id) {
      for (var i = 0; i < FOODS.length; i++) if (FOODS[i].id === id) { out.push(FOODS[i]); return; }
    });
    return out;
  }

  /* 按新资料 / 体重重算基准（保留已下调的碳水） */
  function rebuildBase(state, weight, overrideKcal) {
    var p = planFrom({
      sex: state.profile.sex,
      age: state.profile.age,
      height: state.profile.height,
      weight: weight,
      activity: state.profile.activity,
      overrideKcal: overrideKcal == null ? state.plan.overrideKcal : overrideKcal
    });
    var plan = state.plan;
    plan.bmr = p.bmr;
    plan.factor = p.factor;
    plan.trainKcal = p.trainKcal;
    plan.tdee = p.tdee;
    plan.kcal = p.kcal;
    plan.base = p.grams;
    plan.overrideKcal = p.overrideKcal;
    return state;
  }

  /* ---------- 体重 ---------- */
  function sortedWeights(state) {
    return state.weights.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function upsertWeight(state, key, kg) {
    var w = sortedWeights(state);
    for (var i = 0; i < w.length; i++) {
      if (w[i].date === key) { w[i].kg = round(kg, 1); state.weights = w; return state; }
    }
    w.push({ date: key, kg: round(kg, 1) });
    state.weights = w.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return state;
  }

  function weightAt(state, key) {
    var w = sortedWeights(state);
    var found = null;
    for (var i = 0; i < w.length; i++) {
      if (w[i].date <= key) found = w[i].kg;
      else break;
    }
    return found;
  }

  function latestWeight(state) {
    var w = sortedWeights(state);
    return w.length ? w[w.length - 1] : null;
  }

  /* ---------- 周 / 结算 ---------- */
  function weekOf(startKey, key) {
    var d = Math.max(0, diffDaysKeys(startKey, key));
    return { week: Math.floor(d / 7) + 1, dayInWeek: (d % 7) + 1, days: d };
  }

  function checkinKey(startKey, week) {
    return addDaysKey(startKey, 7 * week - 1);
  }

  /* 最早一个已到期但未结算的周，没有则 null */
  function dueWeek(state, key) {
    var d = diffDaysKeys(state.startDate, key);
    if (d < 6) return null;
    var maxWeek = Math.floor(d / 7) + 1;
    for (var w = 1; w <= maxWeek; w++) {
      if (diffDaysKeys(checkinKey(state.startDate, w), key) < 0) continue;
      var done = false;
      for (var i = 0; i < state.checkins.length; i++) {
        if (state.checkins[i].week === w) { done = true; break; }
      }
      if (!done) return w;
    }
    return null;
  }

  /*
   * 结算一周：endWeight 为该周第 7 天（空腹）体重
   * 返回 { checkin, pending }，由调用方写回 state
   */
  function settleWeek(state, week, endWeight) {
    var plan = state.plan;
    var startDateKey = addDaysKey(state.startDate, 7 * (week - 1));
    var scheduled = checkinKey(state.startDate, week);
    var startWeight = weightAt(state, startDateKey);
    if (startWeight == null) startWeight = state.profile.weightStart;

    var target = round(weeklyTargetKg(startWeight, plan.monthPct), 2);
    var actual = round(startWeight - endWeight, 2);
    var hit = actual >= target - 0.02;
    var fast = actual > target * 1.6 && actual > 0.2;
    var carbNow = currentTargets(plan).carb;

    var checkin = {
      week: week,
      date: scheduled,
      settledOn: todayKey(),
      startWeight: round(startWeight, 1),
      endWeight: round(endWeight, 1),
      target: target,
      actual: actual,
      hit: hit,
      fast: fast,
      carbBefore: carbNow,
      carbAfter: carbNow,
      action: hit ? 'hold' : 'pending'
    };

    var pending = null;
    if (!hit) {
      pending = {
        week: week,
        amount: plan.stepG,
        carbBefore: carbNow,
        createdAt: todayKey(),
        dueDate: addDaysKey(todayKey(), 3)
      };
    }
    return { checkin: checkin, pending: pending };
  }

  /* 应用一次调碳：写入 plan.adjustments */
  function applyCarbCut(state, pending) {
    state.plan.adjustments.push({
      date: todayKey(),
      grams: pending.amount,
      week: pending.week
    });
    for (var i = 0; i < state.checkins.length; i++) {
      if (state.checkins[i].week === pending.week) {
        state.checkins[i].action = 'reduce';
        state.checkins[i].carbAfter = currentTargets(state.plan).carb;
      }
    }
    state.pendings = state.pendings.filter(function (p) { return p !== pending; });
    return state;
  }

  /* ---------- 饮食记录 ---------- */
  function dayTotals(state, key) {
    var list = state.foods[key] || [];
    var out = { carb: 0, protein: 0, fat: 0, kcal: 0 };
    for (var i = 0; i < list.length; i++) {
      out.carb += toNum(list[i].carb);
      out.protein += toNum(list[i].protein);
      out.fat += toNum(list[i].fat);
    }
    out.kcal = out.carb * KCAL.carb + out.protein * KCAL.protein + out.fat * KCAL.fat;
    return out;
  }

  function foodMacros(food, grams) {
    var k = toNum(grams) / 100;
    return {
      carb: round(food.carb * k, 1),
      protein: round(food.protein * k, 1),
      fat: round(food.fat * k, 1)
    };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- 校验 ---------- */
  function validateProfile(input) {
    var errs = [];
    var age = toNum(input.age), height = toNum(input.height), weight = toNum(input.weight);
    if (!(age >= 14 && age <= 80)) errs.push('年龄请填 14–80');
    if (!(height >= 120 && height <= 230)) errs.push('身高请填 120–230 cm');
    if (!(weight >= 35 && weight <= 300)) errs.push('体重请填 35–300 kg');
    if (input.goalWeight && toNum(input.goalWeight) > 0) {
      if (toNum(input.goalWeight) < 30 || toNum(input.goalWeight) >= weight) errs.push('目标体重应小于当前体重');
    }
    return errs;
  }

  /* 安全提示：只提示，不阻止 */
  function safetyNotes(profile, plan, targets) {
    var notes = [];
    var h = toNum(profile.height) / 100;
    var bmi = h > 0 ? toNum(profile.weightStart) / (h * h) : 0;
    if (bmi && bmi < 18.5) notes.push('BMI ' + round(bmi, 1) + '，偏低，减脂前建议先咨询医生。');
    if (targets && targets.carb < 50) notes.push('当前碳水低于 50 g，属于极低碳水区间，注意电解质与训练状态。');
    return notes;
  }

  return {
    VERSION: VERSION,
    KCAL: KCAL,
    FAT_KCAL_PER_KG: FAT_KCAL_PER_KG,
    ACTIVITY: ACTIVITY,
    ACTIVITY_LIST: ACTIVITY_LIST,
    FOODS: FOODS,
    FOOD_GROUPS: FOOD_GROUPS,
    WORKOUT_TYPES: WORKOUT_TYPES,
    workoutLabel: workoutLabel,
    addWorkout: addWorkout,
    removeWorkout: removeWorkout,
    workoutStats: workoutStats,
    weeklyWorkouts: weeklyWorkouts,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    favoriteFoods: favoriteFoods,

    round: round, toNum: toNum, clamp: clamp,
    toKey: toKey, fromKey: fromKey, todayKey: todayKey,
    addDays: addDays, addDaysKey: addDaysKey, diffDays: diffDays, diffDaysKeys: diffDaysKeys,

    bmr: bmr,
    factorOf: factorOf,
    planFrom: planFrom,
    weeklyTargetKg: weeklyTargetKg,
    currentTargets: currentTargets,
    carbCutToKcal: carbCutToKcal,
    kcalToFatKg: kcalToFatKg,

    createState: createState,
    rebuildBase: rebuildBase,

    sortedWeights: sortedWeights,
    upsertWeight: upsertWeight,
    weightAt: weightAt,
    latestWeight: latestWeight,

    weekOf: weekOf,
    checkinKey: checkinKey,
    dueWeek: dueWeek,
    settleWeek: settleWeek,
    applyCarbCut: applyCarbCut,

    dayTotals: dayTotals,
    foodMacros: foodMacros,
    newId: newId,
    validateProfile: validateProfile,
    safetyNotes: safetyNotes
  };
});
