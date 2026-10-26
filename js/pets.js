/* 二楞 (golden retriever) and 发财 (cream British Shorthair): illustrations and lines */
"use strict";
const PET_NAMES = {dog:"二楞", cat:"发财"};
// poses: dog sit / walk / bow / lie, cat sit / walk / stretch / sleep, plus round head crops for avatars
const petImg = (kind, pose, cls = "", alt) => `<img class="${cls}" src="img/pets/${kind}-${pose}.webp" alt="${alt == null ? PET_NAMES[kind] : alt}" decoding="async">`;
const petFace = (kind, cls = "") => `<span class="av ${kind} ${cls}">${petImg(kind, "head", "", "")}</span>`;

const PET_LINES = {
  dog:{
    happy:["今天走得真开心,明天见。","运动完的 {name},整个人都亮了。","今天的任务完成了,我们都很棒。","尾巴一直没停下来,谢谢你带我出门。"],
    normal:["饭后陪我散散步?","出去走 10 分钟就好,我已经在门口等你了。","今天的计划我记着呢,点「开始」就行。","动一动,心情会好一点。","饭后走一走,血糖也会稳一些。"],
    sad:["好几天没出门了,今天走一小段好不好?","不用勉强,只做 5 分钟也算数。","我有点想念我们一起晒太阳的时候。"],
    sleepy:["该睡了,明天一起去公园。","晚安 {name},今天辛苦了。"],
    morning:["早上好 {name},今天的天气适合散步。","早起的 {name},先喝杯温水。"]
  },
  cat:{
    normal:["你动,我看着。分工明确。","我天生胖橘,你可以不是。","运动完记得喝水,别学我只会躺着。","想躺平?这是我的专利。","先站起来。站起来就赢了一半。"],
    happy:["……还行吧。","今天勉强承认你很厉害。","可以摸一下我的头。只限一次。"],
    sleepy:["别吵,我在养膘。","夜深了,我批准你去睡觉。"],
    sad:["我才没有担心你。……就是有点无聊。","你再不动,我都要比你瘦了。"],
    morning:["早。我已经伸过三次懒腰了,你呢?"]
  }
};
