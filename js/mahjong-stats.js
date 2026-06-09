// =============================================================================
// 麻雀統計データ (window.MahjongStats)
// -----------------------------------------------------------------------------
// 「麻雀データ」ページ（下部ナビ📚）で参照する、麻雀の統計・確率データ。
// app.js の renderMahjongStats() がこの window.MahjongStats を読んで描画する。
//
// ▼ データの増やし方
//   categories 配列に { id, name, icon, items:[...] } を追記するだけ。
//   各 item:
//     name   … 統計の名称（必須）
//     value  … 数値（文字列。'0.044' / '5,789' / '21〜24' のような表記も可・必須）
//     unit   … 単位（'%','点','回に1回' 等・任意）
//     note   … 補足説明（任意）
//     source … 出典/根拠（任意）
//
// ▼ 出典について
//   下記の数値は公開されている麻雀統計サイトの集計値を基にしています。
//   ・役/役満の出現率: 麻雀研究 (mahjong.red) ＝ 4人麻雀の和了集計ベース
//   ・対局スタッツ: 天鳳 鳳凰卓統計 2023 (kobalab.net)
//   ・裏ドラ/目安: 各確率解説サイト（麻雀豆腐 ほか）, 三麻の覚え書き(kanrocandy) ほか
//   集計母体・ルール（赤あり/なし等）により数値は変動します。
//   値を更新したら sw.js の CACHE_NAME を必ず bump してください。
// =============================================================================

window.MahjongStats = {
    updated: '2026-06-09',
    categories: [
        {
            id: 'yakuman',
            name: '役満',
            icon: '🀄',
            items: [
                { name: '役満（全般）', value: '約0.05', unit: '%', note: 'いずれかの役満で和了する確率の目安。およそ2000和了に1回程度。', source: '麻雀研究 (mahjong.red)' },
                { name: '四暗刻', value: '0.049', unit: '%', note: '暗刻を4つ揃える役満。役満の中では比較的出やすい部類。', source: '麻雀研究 (mahjong.red)' },
                { name: '国士無双', value: '0.043', unit: '%', note: '13種の么九牌（1・9・字牌）を各1枚以上＋いずれか1枚を雀頭に。', source: '麻雀研究 (mahjong.red)' },
                { name: '大三元', value: '0.039', unit: '%', note: '白・發・中をすべて刻子（槓子）で揃える役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '四喜和（大四喜・小四喜）', value: '0.012', unit: '%', note: '風牌（東南西北）を刻子で揃える役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '字一色', value: '0.008', unit: '%', note: '字牌のみで手を構成する役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '九蓮宝燈', value: '0.0045', unit: '%', note: '清一色の特定形。門前でのみ成立する役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '清老頭', value: '0.0018', unit: '%', note: '1・9の数牌のみで刻子を揃える役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '地和', value: '0.0016', unit: '%', note: '子が第1ツモで和了する役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '緑一色', value: '0.0011', unit: '%', note: '索子の2・3・4・6・8と發のみで構成する役満。', source: '麻雀研究 (mahjong.red)' },
                { name: '天和', value: '0.0003', unit: '%', note: '親が配牌時点で和了。約33万回に1回の極めて稀なケース。', source: '麻雀研究 (mahjong.red)' },
                { name: '四槓子', value: '0.0002', unit: '%', note: '4つの槓子を揃える、最も出にくい部類の役満。', source: '麻雀研究 (mahjong.red)' }
            ]
        },
        {
            id: 'yaku',
            name: '役の出現率',
            icon: '🎴',
            items: [
                { name: '立直', value: '45.1', unit: '%', note: '和了した手のうち立直を含む割合。最も多い役。', source: '麻雀研究 (mahjong.red)' },
                { name: '役牌（飜牌）', value: '40.0', unit: '%', note: '三元牌・場風・自風の刻子。', source: '麻雀研究 (mahjong.red)' },
                { name: '断么九（タンヤオ）', value: '21.4', unit: '%', note: '2〜8の数牌のみで構成。', source: '麻雀研究 (mahjong.red)' },
                { name: '平和', value: '19.9', unit: '%', note: '順子主体・両面待ち等の門前役。', source: '麻雀研究 (mahjong.red)' },
                { name: '門前清自摸和（ツモ）', value: '17.6', unit: '%', note: '門前でツモ和了。', source: '麻雀研究 (mahjong.red)' },
                { name: '一発', value: '10.2', unit: '%', note: '立直から1巡以内に和了。', source: '麻雀研究 (mahjong.red)' },
                { name: '混一色（ホンイツ）', value: '6.31', unit: '%', note: '1種類の数牌＋字牌で構成。', source: '麻雀研究 (mahjong.red)' },
                { name: '一盃口', value: '4.75', unit: '%', note: '同じ順子2組（門前）。', source: '麻雀研究 (mahjong.red)' },
                { name: '対々和（トイトイ）', value: '3.92', unit: '%', note: '刻子4つ＋雀頭で構成。', source: '麻雀研究 (mahjong.red)' },
                { name: '三色同順', value: '3.46', unit: '%', note: '同じ順子を3色で揃える。', source: '麻雀研究 (mahjong.red)' },
                { name: '七対子（チートイツ）', value: '2.52', unit: '%', note: '7つの対子で構成。', source: '麻雀研究 (mahjong.red)' },
                { name: '一気通貫', value: '1.75', unit: '%', note: '同じ色で1〜9を一通り揃える。', source: '麻雀研究 (mahjong.red)' },
                { name: '混全帯么九（チャンタ）', value: '1.24', unit: '%', note: '全ての面子に么九牌を含む。', source: '麻雀研究 (mahjong.red)' },
                { name: '清一色（チンイツ）', value: '0.94', unit: '%', note: '1種類の数牌のみで構成。', source: '麻雀研究 (mahjong.red)' },
                { name: '三暗刻', value: '0.76', unit: '%', note: '暗刻を3つ揃える。', source: '麻雀研究 (mahjong.red)' },
                { name: '河底撈魚（ハイテイ/ホウテイ）', value: '0.63', unit: '%', note: '最終捨て牌でロン和了。', source: '麻雀研究 (mahjong.red)' },
                { name: '純全帯么九（ジュンチャン）', value: '0.38', unit: '%', note: '全ての面子に老頭牌を含む（字牌なし）。', source: '麻雀研究 (mahjong.red)' },
                { name: '海底摸月', value: '0.31', unit: '%', note: '最終ツモで和了。', source: '麻雀研究 (mahjong.red)' },
                { name: '嶺上開花', value: '0.28', unit: '%', note: '槓の嶺上牌で和了。', source: '麻雀研究 (mahjong.red)' },
                { name: 'ダブル立直', value: '0.19', unit: '%', note: '第1巡で立直。', source: '麻雀研究 (mahjong.red)' },
                { name: '小三元', value: '0.15', unit: '%', note: '三元牌の2種を刻子、1種を雀頭。', source: '麻雀研究 (mahjong.red)' },
                { name: '混老頭', value: '0.08', unit: '%', note: '么九牌（1・9・字牌）のみで構成。対々和か七対子を伴う。', source: '麻雀研究 (mahjong.red)' },
                { name: '三色同刻', value: '0.05', unit: '%', note: '同じ数字の刻子を3色で揃える。', source: '麻雀研究 (mahjong.red)' },
                { name: '二盃口', value: '0.05', unit: '%', note: '一盃口を2組（門前のみ）。', source: '麻雀研究 (mahjong.red)' },
                { name: '槍槓（チャンカン）', value: '0.05', unit: '%', note: '他家の加槓牌でロン和了。', source: '麻雀研究 (mahjong.red)' }
            ]
        },
        {
            id: 'uradora',
            name: '裏ドラ',
            icon: '🎰',
            items: [
                { name: '立直和了で裏ドラが1枚以上乗る確率', value: '約30', unit: '%', note: '立直して和了した局のうち裏ドラが乗る割合の目安（約1/3）。手牌構成で変動。', source: '各確率解説サイト（麻雀豆腐 ほか）' },
                { name: '裏ドラの平均枚数（リーチ和了あたり）', value: '約0.3〜0.4', unit: '枚', note: '実戦集計の例では1,311回のリーチ和了で裏ドラ計470枚 ≒ 0.36枚。乗らない局が多いが、乗ると一気に打点が跳ねる。', source: '実戦集計（pystyle ほか）' },
                { name: '平和形で裏ドラが乗る確率', value: '約38', unit: '%', note: '順子主体・牌の重なりが無い平和形なら約38%（3回に1回）。刻子形より乗りやすい。', source: '銀座ファミリー麻雀教室 ほか' },
                { name: '暗刻・一盃口があると裏ドラは乗りにくい', value: '約32〜35', unit: '%', note: '同じ牌の重なりが1つで約35%、2つで約32%に低下。刻子の多い手は裏が乗りにくい。', source: '銀座ファミリー麻雀教室 ほか' },
                { name: '七対子で裏ドラが乗る確率', value: '約20.5', unit: '%', note: '対子主体のため平和形より乗りにくい（約5回に1回）。', source: '各確率解説サイト（麻雀豆腐 ほか）' },
                { name: '槓ドラ1回（表ドラ2枚）時の裏1枚以上', value: '約60', unit: '%', note: 'カンによりドラ表示が増えると裏ドラの乗る確率も上昇。', source: '各確率解説サイト' },
                { name: '槓ドラ2回（表ドラ3枚）時の裏1枚以上', value: '約75', unit: '%', note: 'カン2回でさらに上昇。', source: '各確率解説サイト' }
            ]
        },
        {
            id: 'stats',
            name: '対局スタッツ',
            icon: '📈',
            items: [
                { name: '和了率', value: '21.1', unit: '%', note: '1局あたりに和了する割合（鳳凰卓・2023年平均）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '放銃率', value: '12.4', unit: '%', note: '1局あたりに振り込む割合（鳳凰卓・2023年平均）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '立直率', value: '18.4', unit: '%', note: '1局あたりに立直する割合（2016年17.0% → 2023年18.4%と上昇傾向）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '副露率', value: '32.6', unit: '%', note: '1局あたりに鳴く割合（2016年34.4% → 2023年32.6%と低下傾向）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '流局率', value: '16.2', unit: '%', note: '1局が流局で終わる割合（2023年）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '和了時にドラを含む割合', value: '56.82', unit: '%', note: '和了した手にドラ（含・赤）が含まれる割合の目安。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '和了時に赤ドラを含む割合', value: '50.68', unit: '%', note: '赤ありルールでの目安。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' }
            ]
        },
        {
            id: 'points',
            name: '点数',
            icon: '💯',
            items: [
                { name: '平均和了打点（全体）', value: '5,789', unit: '点', note: '1回の和了で得る点数の平均（鳴き・ダマ含む全和了。鳳凰卓・2023年）。', source: '天鳳 鳳凰卓統計 2023 (kobalab.net)' },
                { name: '立直の平均打点（子・赤あり）', value: '約7,000', unit: '点', note: 'リーチして和了した子の平均打点。全体平均より高く、リーチが打点を押し上げることが分かる。', source: '麻雀の強化書' },
                { name: '立直の平均打点（親・赤あり）', value: '約10,000', unit: '点', note: '親のリーチ和了の平均打点（10,000点弱）。親は子の1.5倍の収入。', source: '麻雀の強化書' },
                { name: '魂天（雀魂最高位帯）の平均打点', value: '約6,000', unit: '点', note: '雀魂の最上位帯プレイヤーの平均和了打点の目安。', source: '雀魂牌譜屋の統計解説（note ほか）' },
                { name: '平均放銃点', value: '和了点より低め', note: 'ツモ和了は全員から点をもらうため高く評価され、平均放銃点は平均和了点よりやや低くなる傾向（和了点 ＞ 放銃点）。', source: 'Wikipedia「麻雀の成績集計」/ 麻雀数理研究会' }
            ]
        },
        {
            id: 'benchmark',
            name: '上達の目安',
            icon: '🎯',
            items: [
                { name: '理想的な和了率の目安', value: '23〜24', unit: '%', note: '強者帯で目標とされる和了率の目安。', source: '三麻の覚え書き (kanrocandy.com) ほか' },
                { name: '理想的な放銃率の目安', value: '11〜12', unit: '%', note: '低く抑えるほど安定するが、和了率とのバランスが重要。', source: '三麻の覚え書き (kanrocandy.com) ほか' },
                { name: '天鳳 七段の平均和了率', value: '22.2', unit: '%', note: '七段帯ユーザーの平均的なスタッツ。', source: '三麻の覚え書き (kanrocandy.com)' },
                { name: '天鳳 七段の平均放銃率', value: '12.5', unit: '%', note: '七段帯ユーザーの平均的なスタッツ。', source: '三麻の覚え書き (kanrocandy.com)' },
                { name: '天鳳 七段の平均副露率', value: '34.7', unit: '%', note: '七段帯ユーザーの平均的なスタッツ。', source: '三麻の覚え書き (kanrocandy.com)' },
                { name: '天鳳 七段の平均立直率', value: '17.4', unit: '%', note: '七段帯ユーザーの平均的なスタッツ。', source: '三麻の覚え書き (kanrocandy.com)' }
            ]
        },
        {
            id: 'haipai',
            name: '配牌・序盤',
            icon: '🎲',
            items: [
                { name: '配牌時の平均向聴数', value: '約3.16', unit: '向聴', note: '4人麻雀・2000万回シミュレーションの実測値。4向聴が最も多い。', source: 'ganohr（四麻配牌データ）' },
                { name: '配牌で一向聴の確率', value: '約2.3', unit: '%', note: 'およそ40回に1回。ここからの和了は十分狙える好配牌。', source: 'ganohr（四麻配牌データ）' },
                { name: '配牌でいきなり聴牌（ダブル立直可能）', value: '約0.15', unit: '%', note: 'およそ1500回に1回。配牌時点で聴牌している超好配牌。', source: 'ganohr（四麻配牌データ）' },
                { name: '配牌で国士無双を狙える形', value: '約2.4', unit: '%', note: '么九牌が多く国士に向いた配牌になる割合。', source: 'ganohr（四麻配牌データ）' },
                { name: '立直が最も多い巡目', value: '8', unit: '巡目', note: '立直の宣言は8巡目がピーク。', source: '天鳳統計 (kobalab.net)' },
                { name: '和了が最も多い巡目', value: '10', unit: '巡目', note: '和了の発生は10巡目がピーク。', source: '天鳳統計 (kobalab.net)' }
            ]
        },
        {
            id: 'trivia',
            name: '確率の小ネタ',
            icon: '💡',
            items: [
                { name: '九種九牌から流さずに和了できる確率', value: '約3', unit: '%', note: '配牌九種九牌でも、流さず手を進めれば終局までに和了できる割合の目安。', source: '麻雀グッズ研究所' },
                { name: '一発ツモの確率', value: '約5', unit: '%', note: 'Mリーグ集計で303一発ツモ / 6,220立直 ≒ 4.87%。一発（ロン含む）は約10%。', source: 'Mリーグ成績速報（非公式）集計' },
                { name: '先制リーチ・リャンメン待ちの和了率', value: '約50', unit: '%', note: '9巡目前後で先制リーチした両面待ちの和了率の目安。巡目・場況で変動。', source: '各統計（雀魂非公式ブログ ほか）' },
                { name: '和了率の巡目補正', value: '約±4', unit: '%/巡', note: '基準より1巡早いと+約4%、1巡遅いと−約4%という概算則。', source: '各統計（リーチ和了率の概算則）' },
                { name: '「37%の法則」', value: '約37', unit: '%', note: '1/e≈0.368。例: リャンメン待ちのダブル立直が17巡で和了できず流局する確率がほぼ37%。', source: '雀魂非公式ブログ（37%の法則）' },
                { name: '強者の長期トップ率の上限目安', value: '約37〜38', unit: '%', note: '理論上どれだけ強くても4人麻雀のトップ率はこのあたりに収束するとされる。', source: '雀魂非公式ブログ（37%の法則）' }
            ]
        }
    ]
};
