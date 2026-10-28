/* 二楞 (golden retriever) and 发财 (cream British Shorthair): illustrations and lines */
"use strict";
const PET_NAMES = {dog:"二楞", cat:"发财"};
// poses: dog sit / sit2 / walk / lie, cat sit / walk / stretch / sleep, plus round head crops for avatars
const petImg = (kind, pose, cls = "", alt) => `<img class="${cls}" src="img/pets/${kind}-${pose}.webp" alt="${alt == null ? PET_NAMES[kind] : alt}" decoding="async">`;
const petFace = (kind, cls = "") => `<span class="av ${kind} ${cls}">${petImg(kind, "head", "", "")}</span>`;

// 二楞: warm, clingy, a bit of a goof, praises everything. 发财: aloof, dry, secretly caring. Both call her 姐姐.
const PET_LINES = {
  dog:{
    happy:["今天走得真开心,明天见!","运动完的姐姐,整个人都在发光!","今天的任务完成啦,我的尾巴停不下来了!","谢谢姐姐带我出门,我最喜欢你了!","我宣布:姐姐是今天全小区最棒的人!","今天表现满分,奖励我……啊不,奖励姐姐!"],
    normal:["姐姐,饭后陪我散散步?","出去走 10 分钟就好,我已经在门口等你啦。","今天的计划我记着呢,点「开始」就行~","动一动,心情会好一点,我保证!","饭后走一走,血糖也会稳一些。","姐姐你看,今天的云像不像一根大骨头?","我把牵引绳叼来了,就放在你脚边哦。","今天也想和姐姐一起晒太阳。","姐姐坐太久啦,起来伸个懒腰吧!","我刚刚追尾巴转了三圈,该你动一动了~"],
    sad:["姐姐好几天没出门了,今天走一小段好不好?","不用勉强,只做 5 分钟也算数。","我有点想念我们一起晒太阳的时候。","我把球放在门口好几天了……"],
    sleepy:["姐姐该睡了,明天一起去公园。","晚安姐姐,今天辛苦了。","我趴在门口守着,姐姐安心睡吧。"],
    morning:["早上好姐姐,今天的天气适合散步!","姐姐早!先喝杯温水,再测个空腹血糖~","早安!我已经醒了三个小时,在等你起床。"]
  },
  cat:{
    normal:["你动,我看着。分工明确。","我天生胖橘,你可以不是。","运动完记得喝水,别学我只会躺着。","想躺平?这是我的专利。","先站起来。站起来就赢了一半。","二楞又在门口转圈了,你去管管。","我不是在偷懒,我是在节能。","今天的阳光归我,运动归你。"],
    happy:["……还行吧。","今天勉强承认你很厉害。","可以摸一下我的头。只限一次。","不错。比二楞强一点。"],
    sleepy:["别吵,我在养膘。","夜深了,我批准你去睡觉。","睡吧。我替你看着二楞。"],
    sad:["我才没有担心你。……就是有点无聊。","你再不动,我都要比你瘦了。","二楞天天在门口叹气,吵死了。"],
    morning:["早。我已经伸过三次懒腰了,你呢?","你醒了?我刚准备睡。"]
  }
};
