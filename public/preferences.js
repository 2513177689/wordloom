// Exam profiles describe writing preferences, not certified CEFR equivalences.
export const LEVELS = {
  cet4: {label:'大学英语四级',group:'学习目标',prompt:'面向大学英语四级备考阅读：以常用词和清晰的复合句为主，适量校园、生活与社会话题，避免堆砌生僻词。'},
  cet6: {label:'大学英语六级',group:'学习目标',prompt:'面向大学英语六级备考阅读：增加抽象词汇、观点论证和较复杂从句，保持自然连贯。'},
  postgrad: {label:'考研英语',group:'学习目标',prompt:'面向考研英语阅读训练：偏重社会、文化与科技议题，适量长难句、逻辑转折和熟词生义。'},
  'ielts-basic': {label:'雅思 · 基础阅读',group:'学习目标',prompt:'面向雅思基础阅读训练：使用清晰的说明文、常见学术话题和适量同义改写，控制句法负担。'},
  'ielts-advanced': {label:'雅思 · 进阶阅读',group:'学习目标',prompt:'面向雅思进阶阅读训练：加入学术论证、复杂句法、指代与同义改写，关注细微含义。'},
  toefl: {label:'托福阅读',group:'学习目标',prompt:'面向托福阅读训练：偏重学术说明、自然与社会科学主题、概念解释和逻辑关系。'},
  ...Object.fromEntries(['A1','A2','B1','B2','C1','C2'].map(id=>[id,{label:`通用英语 ${id}`,group:'通用分级',prompt:`按 CEFR ${id} 控制整体词汇与句式难度。`}]))
};
export const READER_DEFAULTS = {readingText:'#414a40',readingBackground:'#fffefa',wordText:'#77542c',wordBackground:'#f4e9d6',selectionText:'#283c31',selectionBackground:'#dce8c9'};
export const COLOR_LABELS={readingText:'正文文字',readingBackground:'阅读背景',wordText:'目标词文字',wordBackground:'目标词背景',selectionText:'划选文字',selectionBackground:'划选背景'};
export const validColor=value=>typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value);
export const levelLabel=id=>LEVELS[id]?.label || id;
