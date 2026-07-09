
window.DDCDB=(function(){
  function g(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function s(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function uid(){return 'id'+Date.now()+Math.floor(Math.random()*1000);}
  // ── sync SHA-256 (for password hashing; demo-grade, no external deps) ──
  function sha256(ascii){
    function rrot(v,a){return (v>>>a)|(v<<(32-a));}
    var m=[],H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
    var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
    var i,j,result='';ascii=unescape(encodeURIComponent(ascii));var words=[],l=ascii.length*8,k;
    for(i=0;i<ascii.length;i++)words[i>>2]|=ascii.charCodeAt(i)<<((3-i%4)*8);
    words[l>>5]|=0x80<<(24-l%32);words[((l+64>>9)<<4)+15]=l;
    for(i=0;i<words.length;i+=16){
      var w=[],a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g2=H[6],h=H[7];
      for(j=0;j<64;j++){
        if(j<16)w[j]=words[i+j]|0;
        else{var s0=rrot(w[j-15],7)^rrot(w[j-15],18)^(w[j-15]>>>3),s1=rrot(w[j-2],17)^rrot(w[j-2],19)^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)|0;}
        var S1=rrot(e,6)^rrot(e,11)^rrot(e,25),ch=(e&f)^((~e)&g2),t1=(h+S1+ch+K[j]+w[j])|0;
        var S0=rrot(a,2)^rrot(a,13)^rrot(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)|0;
        h=g2;g2=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g2)|0;H[7]=(H[7]+h)|0;
    }
    for(i=0;i<8;i++)for(j=3;j>=0;j--){var by=(H[i]>>>(j*8))&255;result+=((by<16)?'0':'')+by.toString(16);}
    return result;
  }
  var PW_SALT='ddc:v1:';
  function hashPass(p){return 'h1$'+sha256(PW_SALT+(p||''));}
  function verifyPass(p,stored){ if(!stored)return false;
    if(stored.indexOf('h1$')===0)return hashPass(p)===stored; // hashed
    return p===stored; // legacy plaintext (pre-migration)
  }
  if(!localStorage.getItem('ddc_db_users')) s('ddc_db_users',[
    {id:'u1',login:'admin',name:'Администратор',dept:'ИТ',role:'admin',pass:'admin'},
    {id:'u2',login:'m.amardinov',name:'Амардинов Малик',dept:'Руководство',role:'manager',pass:'demo'},
    {id:'u3',login:'a.arinova',name:'Аринова Айжан',dept:'Цифровая трансформация',role:'employee',pass:'demo'},
    {id:'u4',login:'e.durmagambetov',name:'Дурмагамбетов Ерлан',dept:'Правление',role:'manager',pass:'demo'},
    {id:'u5',login:'soc',name:'Оператор SOC',dept:'Кибербезопасность',role:'security',pass:'soc'}
  ]);
  var DDC_NEWS=[
    {id:'an1',tag:'Проекты',title:'«Депозитный регистр» — новый этап',text:'ЦЦР развивает централизованную систему учёта депозитов и вкладов: единый источник достоверных данных, защита вкладчиков и интеграция с экосистемой НБРК.'},
    {id:'an2',tag:'Данные',title:'Фабрика данных НБК',text:'Единая цифровая экосистема для хранения и анализа данных: обработка ускорена в 6,6 раза, отчёты в Qlik Sense и Denodo формируются за секунды.'},
    {id:'an3',tag:'Закупки',title:'Портал закупок: свыше 194 млрд ₸',text:'На платформе уже более 15 000 пользователей и 9 000 поставщиков, проведено свыше 29 000 закупок на общую сумму более 194 млрд тенге.'},
    {id:'an4',tag:'Безопасность',title:'Кибербезопасность 24/7',text:'Команда информационной безопасности круглосуточно мониторит угрозы, защищает инфраструктуру и данные НБК, проводит аудит и внедряет DevSecOps.'},
    {id:'an5',tag:'Инфраструктура',title:'Tech Talks: инфраструктура в цифрах',text:'28 специалистов обеспечивают работу 1163 виртуальных машин, 36 серверов и телеком-инфраструктуры по всему Казахстану.'}
  ];
  if(!localStorage.getItem('ddc_db_ann')) s('ddc_db_ann',DDC_NEWS);
  if(localStorage.getItem('ddc_ann_v')!=='5'){ try{s('ddc_db_ann',DDC_NEWS);localStorage.setItem('ddc_ann_v','5');}catch(e){} }
  if(!localStorage.getItem('ddc_db_apps')) s('ddc_db_apps',[]);
  if(!localStorage.getItem('ddc_db_reqs')) s('ddc_db_reqs',[]);
  var DEFAULT_COURSES=[
    {id:'c1',title:'Основы информационной безопасности',desc:'Базовые правила ИБ: фишинг, пароли, безопасная работа с данными.',duration:'2 часа',level:'Базовый',
     video:'ZHl0WI32XkY',
     intro:'Курс знакомит с базовыми принципами информационной безопасности: защита паролей, распознавание фишинга, двухфакторная аутентификация и безопасная работа с корпоративными данными и устройствами.',
     materials:[
       {title:'NIST — рекомендации по паролям (SP 800-63B)',url:'https://pages.nist.gov/800-63-3/sp800-63b.html'},
       {title:'OWASP Top 10 — основные веб-угрозы',url:'https://owasp.org/www-project-top-ten/'},
       {title:'CISA — Secure Our World',url:'https://www.cisa.gov/secure-our-world'}
     ],
     quiz:[
       {q:'Что такое фишинг?',opts:['Вид сетевого протокола','Попытка обманом получить данные через поддельные сообщения','Антивирусная программа','Метод резервного копирования'],a:1},
       {q:'Какой пароль наиболее надёжный?',opts:['qwerty123','Дата рождения','Длинная фраза из случайных слов и символов','Имя питомца'],a:2},
       {q:'Что делать при получении подозрительного письма со ссылкой?',opts:['Сразу перейти по ссылке','Переслать всем коллегам','Не открывать вложения и сообщить в службу ИБ','Ответить отправителю'],a:2},
       {q:'Зачем нужна двухфакторная аутентификация (2FA)?',opts:['Ускоряет вход','Добавляет второй уровень подтверждения личности','Заменяет пароль','Отключает антивирус'],a:1},
       {q:'Можно ли использовать один пароль для всех сервисов?',opts:['Да, так удобнее','Нет, утечка одного раскроет все аккаунты','Да, если он сложный','Только на работе'],a:1},
       {q:'Что такое социальная инженерия?',opts:['Проектирование зданий','Манипуляция людьми для получения доступа или данных','Вид программирования','Тип сетевого кабеля'],a:1},
       {q:'Как безопасно работать с публичным Wi-Fi?',opts:['Вводить пароли как обычно','Использовать VPN и избегать конфиденциальных операций','Отключить блокировку экрана','Делиться паролем сети'],a:1},
       {q:'Признак поддельного (фишингового) сайта:',opts:['Наличие HTTPS всегда гарантирует подлинность','Опечатки в адресе и срочные требования ввести данные','Красивый дизайн','Быстрая загрузка'],a:1},
       {q:'Что делать с конфиденциальными документами при уходе с места?',opts:['Оставлять открытыми','Блокировать экран и убирать документы','Печатать и раздавать','Загружать в личное облако'],a:1},
       {q:'Куда сообщать об инциденте ИБ в ЦЦР?',opts:['Никуда','В социальные сети','В службу ИБ / Service Desk 1477','Коллеге по телефону'],a:2}
     ]},
    {id:'c2',title:'Внутренние регламенты ЦЦР',desc:'Процессы, политики и стандарты работы в компании.',duration:'1 час',level:'Обязательный',
     intro:'Курс описывает ключевые процессы, политики и стандарты работы в АО «Центр цифрового развития Национального Банка Казахстана»: историю, структуру, политику качества и информационной безопасности.',
     materials:[
       {title:'Политика качества и ИБ — раздел «О нас»',url:'about.html#certs'},
       {title:'История и развитие компании',url:'about.html#history'},
       {title:'База знаний и регламенты (FAQ)',url:'media.html#faq'}
     ],
     quiz:[
       {q:'Как сейчас называется компания?',opts:['Банковское сервисное бюро НБ РК','АО «Центр цифрового развития Национального Банка Казахстана»','Национальный Банк РК','Казначейство'],a:1},
       {q:'В каком году основана компания?',opts:['2003','2015','1995','2025'],a:2},
       {q:'Кто является единственным акционером?',opts:['Частный инвестор','Национальный Банк Республики Казахстан','Правительство РК','Иностранный фонд'],a:1},
       {q:'Номер контакт-центра Национального Банка:',opts:['102','1414','1477','911'],a:2},
       {q:'Какой стандарт менеджмента качества внедрён в компании?',opts:['ISO 9001','ISO 14001','HACCP','GMP'],a:0},
       {q:'Что относится к деятельности ЦЦР?',opts:['Только бухгалтерия','Портал закупок, контакт-центр 1477, кибербезопасность, управление данными','Розничная торговля','Строительство'],a:1},
       {q:'Когда произошла реорганизация в ЦЦР?',opts:['18 июля 2025 года','1 января 2020 года','23 июля 2015 года','Ещё не произошла'],a:0},
       {q:'Что нужно соблюдать при доступе к конфиденциальной информации?',opts:['Свободно делиться','Политику ИБ и принцип минимальных привилегий','Хранить на личном устройстве','Публиковать в чатах'],a:1},
       {q:'Куда обращаться по ИТ-вопросам?',opts:['В HR','В Service Desk / контакт-центр 1477','К директору лично','Никуда'],a:1},
       {q:'Что подтверждает орган сертификации TÜV NORD?',opts:['Финансовую отчётность','Соответствие СМК стандарту ISO 9001','Уплату налогов','Штатное расписание'],a:1}
     ]},
    {id:'c3',title:'Введение в Agile',desc:'Методологии разработки, спринты и роли в команде.',duration:'3 часа',level:'Средний',
     video:'502ILHjX9EE',
     intro:'Базовые понятия гибких методологий: ценности Agile-манифеста, фреймворк Scrum, спринты, роли (Product Owner, Scrum Master, команда) и артефакты.',
     materials:[
       {title:'Agile-манифест (RU)',url:'https://agilemanifesto.org/iso/ru/manifesto.html'},
       {title:'The Scrum Guide',url:'https://scrumguides.org/'}
     ],
     quiz:[
       {q:'Что лежит в основе Agile?',opts:['Жёсткое следование плану','Гибкость и итеративная поставка ценности','Отсутствие документации','Работа в одиночку'],a:1},
       {q:'Что такое спринт в Scrum?',opts:['Ежегодное собрание','Короткий фиксированный отрезок времени для создания инкремента','Название роли','Тип документа'],a:1},
       {q:'Кто отвечает за приоритеты product backlog?',opts:['Scrum Master','Product Owner','Тестировщик','Заказчик напрямую'],a:1},
       {q:'Чем занимается Scrum Master?',opts:['Раздаёт задачи и контролирует','Помогает команде следовать процессу и устраняет препятствия','Пишет весь код','Утверждает бюджет'],a:1},
       {q:'Что такое Daily Scrum?',opts:['Ежедневная короткая синхронизация команды','Отчёт руководству','Премия','Релиз'],a:0},
       {q:'Сколько ценностей в Agile-манифесте?',opts:['4','12','7','3'],a:0},
       {q:'Что важнее по манифесту?',opts:['Инструменты важнее людей','Люди и взаимодействие важнее процессов и инструментов','Документация важнее работающего продукта','Контракт важнее сотрудничества'],a:1},
       {q:'Что такое инкремент?',opts:['Ошибка','Работающая часть продукта по итогам спринта','Совещание','Роль в команде'],a:1},
       {q:'Что делают на ретроспективе?',opts:['Планируют отпуск','Анализируют, как улучшить процесс работы команды','Проводят увольнения','Презентуют продукт клиенту'],a:1},
       {q:'Что такое user story?',opts:['Биография пользователя','Краткое описание требования с точки зрения пользователя','Отчёт об ошибке','Техническая спецификация'],a:1}
     ]},
    {id:'c4',title:'Работа с данными и аналитика',desc:'Основы SQL, визуализация и культура работы с данными.',duration:'4 часа',level:'Средний',
     video:'HXV3zeQKqGY',
     intro:'Основы SQL и реляционных баз данных, принципы выборки и объединения данных, визуализация и культура работы с данными.',
     materials:[
       {title:'SQL Tutorial — W3Schools',url:'https://www.w3schools.com/sql/'},
       {title:'Документация PostgreSQL',url:'https://www.postgresql.org/docs/'}
     ],
     quiz:[
       {q:'Что означает аббревиатура SQL?',opts:['Structured Query Language','Simple Question Logic','System Quality Level','Secure Query Link'],a:0},
       {q:'Какой оператор выбирает данные?',opts:['INSERT','SELECT','DELETE','DROP'],a:1},
       {q:'Для чего нужен WHERE?',opts:['Сортировка','Фильтрация строк по условию','Создание таблицы','Удаление базы'],a:1},
       {q:'Что делает JOIN?',opts:['Удаляет данные','Объединяет строки из нескольких таблиц','Создаёт индекс','Делает бэкап'],a:1},
       {q:'Что такое PRIMARY KEY?',opts:['Поле, которое может повторяться','Уникальный идентификатор строки в таблице','Всегда текстовое поле','Необязательный элемент'],a:1},
       {q:'Какой оператор группирует строки?',opts:['ORDER BY','GROUP BY','LIMIT','DISTINCT'],a:1},
       {q:'Что вернёт COUNT(*)?',opts:['Сумму значений','Количество строк','Среднее значение','Максимум'],a:1},
       {q:'Чем характеризуется реляционная БД?',opts:['Хранит данные в связанных таблицах','Хранит только файлы','Не имеет структуры','Работает только в облаке'],a:0},
       {q:'Зачем нужна визуализация данных?',opts:['Усложнить отчёт','Сделать данные понятными для принятия решений','Заменить базу данных','Удалить данные'],a:1},
       {q:'Что такое «грязные данные» (dirty data)?',opts:['Зашифрованные данные','Данные с ошибками, дубликатами и пропусками','Большие данные','Открытые данные'],a:1}
     ]},
    {id:'c5',title:'Защита от фишинга и социальной инженерии',desc:'Распознавание фишинга, вишинга, смишинга и приёмов манипуляции.',duration:'1 час',level:'Базовый',
     video:'ZHl0WI32XkY',
     intro:'Углублённый курс о том, как распознавать фишинг, вишинг (звонки), смишинг (SMS) и приёмы социальной инженерии — и правильно на них реагировать.',
     materials:[
       {title:'CISA — защита от фишинга',url:'https://www.cisa.gov/secure-our-world'},
       {title:'OWASP — каталог атак',url:'https://owasp.org/www-community/attacks/'}
     ],
     quiz:[
       {q:'Вишинг — это фишинг через…',opts:['Email','Телефонный звонок','SMS','USB-носитель'],a:1},
       {q:'Смишинг — это атака через…',opts:['SMS-сообщения','Социальные сети','Email','Голосовой звонок'],a:0},
       {q:'Типичный признак фишингового письма:',opts:['Персональное обращение по имени','Срочность и угроза блокировки аккаунта','Корректный домен отправителя','Отсутствие каких-либо ссылок'],a:1},
       {q:'Что такое «претекстинг»?',opts:['Предварительный текст письма','Создание ложного сценария для втирания в доверие','Метод шифрования','Тип антивируса'],a:1},
       {q:'Реакция на «срочный перевод денег» от «руководителя»:',opts:['Сразу перевести','Проверить запрос по другому каналу связи','Игнорировать всех','Опубликовать в чате'],a:1},
       {q:'Приём «baiting» (приманка) часто использует:',opts:['Брошенные USB-носители','Облачные сервисы','Сетевой принтер','Резервный сервер'],a:0},
       {q:'Как проверить настоящий адрес ссылки в письме?',opts:['Никак','Навести курсор и посмотреть реальный URL','Кликнуть и проверить','Спросить отправителя'],a:1},
       {q:'Лучшая защита от социальной инженерии:',opts:['Дорогой антивирус','Осведомлённость и проверка подозрительных запросов','Быстрый интернет','Новый ноутбук'],a:1},
       {q:'Вы перешли по фишинговой ссылке и ввели пароль. Что делать?',opts:['Ничего','Немедленно сменить пароль и сообщить в ИБ','Подождать неделю','Переустановить браузер'],a:1},
       {q:'Можно ли доверять письму только из-за логотипа компании?',opts:['Да','Нет, логотипы легко подделать','Да, если красиво оформлено','Только по будням'],a:1}
     ]},
    {id:'c6',title:'Цифровая гигиена и защита данных',desc:'Обновления, бэкапы, управление доступом и защита персональных данных.',duration:'1.5 часа',level:'Базовый',
     intro:'Принципы цифровой гигиены: обновления и резервные копии, управление доступом, менеджеры паролей и защита персональных данных в повседневной работе.',
     materials:[
       {title:'CISA — Secure Our World',url:'https://www.cisa.gov/secure-our-world'},
       {title:'Have I Been Pwned — проверка утечек',url:'https://haveibeenpwned.com/'}
     ],
     quiz:[
       {q:'Зачем регулярно обновлять ПО?',opts:['Для красоты интерфейса','Чтобы закрывать уязвимости безопасности','Чтобы тратить трафик','Это не нужно'],a:1},
       {q:'От чего защищает резервное копирование?',opts:['От рекламы','От потери данных при сбое или шифровальщике','От медленного интернета','От спама'],a:1},
       {q:'Принцип минимальных привилегий означает:',opts:['Всем полный доступ','Доступ только к тому, что нужно для работы','Работу без паролей','Один общий аккаунт на всех'],a:1},
       {q:'Зачем нужен менеджер паролей?',opts:['Хранить уникальные пароли, помня один мастер-пароль','Делиться паролями с коллегами','Отключать 2FA','Ускорять компьютер'],a:0},
       {q:'Что делать со старыми ненужными учётными записями?',opts:['Оставить как есть','Удалить или деактивировать','Передать другим','Опубликовать'],a:1},
       {q:'Блокировка экрана при уходе с места:',opts:['Не нужна','Обязательна для защиты данных','Только ночью','Только дома'],a:1},
       {q:'Что относится к персональным данным?',opts:['Только пароль','Сведения, идентифицирующие человека: ФИО, ИИН, телефон','Только email','Публичные новости'],a:1},
       {q:'Безопасно ли хранить рабочие данные в личном облаке?',opts:['Да, всегда','Нет, это нарушает политику и создаёт риск утечки','Да, если бесплатно','Только по выходным'],a:1},
       {q:'Что такое утечка данных (data breach)?',opts:['Плановый бэкап','Несанкционированный доступ или раскрытие данных','Обновление системы','Шифрование диска'],a:1},
       {q:'Как проверить, попадал ли email в известные утечки?',opts:['Никак','Через сервисы вроде Have I Been Pwned','Спросить у коллеги','Перезагрузить ПК'],a:1}
     ]}
  ];
  var COURSE_SEED_VER='2';
  if(!localStorage.getItem('ddc_db_courses')){
    s('ddc_db_courses',DEFAULT_COURSES); try{localStorage.setItem('ddc_courses_ver',COURSE_SEED_VER);}catch(e){}
  } else if(localStorage.getItem('ddc_courses_ver')!==COURSE_SEED_VER){
    // upsert default courses (refresh content) while keeping user-created ones
    var cur=g('ddc_db_courses',[]); var byId={}; cur.forEach(function(c){byId[c.id]=c;});
    DEFAULT_COURSES.forEach(function(c){byId[c.id]=c;});
    var ids=DEFAULT_COURSES.map(function(c){return c.id;});
    var extras=cur.filter(function(c){return ids.indexOf(c.id)<0;});
    s('ddc_db_courses',DEFAULT_COURSES.concat(extras));
    try{localStorage.setItem('ddc_courses_ver',COURSE_SEED_VER);}catch(e){}
  }
  if(!localStorage.getItem('ddc_db_chat')) s('ddc_db_chat',[
    {id:'m1',user:'Администратор',login:'admin',text:'Добро пожаловать в командный чат ЦЦР!',ts:new Date(Date.now()-3600000).toISOString()}
  ]);
  if(!localStorage.getItem('ddc_db_progress')) s('ddc_db_progress',{});
  if(!localStorage.getItem('ddc_db_dm')) s('ddc_db_dm',[]);
  if(!localStorage.getItem('ddc_db_audit')) s('ddc_db_audit',[]);
  // ── migrate any plaintext passwords to hashes ──
  function migratePasswords(){
    try{ var u=g('ddc_db_users',[]),ch=false;
      u.forEach(function(x){ if(x.pass&&!x.passh){x.passh=hashPass(x.pass);delete x.pass;ch=true;}
        else if(x.pass&&x.passh){delete x.pass;ch=true;} });
      if(ch)s('ddc_db_users',u);
    }catch(e){}
  }
  migratePasswords();
  var API=(window.DDC_API||'');
  // ── Supabase (REST) cloud sync ──
  var SB_URL=(window.SUPABASE_URL||'').replace(/\/+$/,'');
  var SB_KEY=(window.SUPABASE_KEY||'');
  var SB_ON=!!(SB_URL&&SB_KEY);
  function sbH(extra){var h={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY};if(extra)for(var k in extra)h[k]=extra[k];return h;}
  function sbGet(path){try{return fetch(SB_URL+'/rest/v1/'+path,{headers:sbH()}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}catch(e){return Promise.resolve(null);}}
  function emit(k){try{window.dispatchEvent(new CustomEvent('ddcdb-sync',{detail:{table:k}}));}catch(e){}}
  function kvUpsert(key){ if(!SB_ON)return;
    try{fetch(SB_URL+'/rest/v1/ddc_kv?on_conflict=k',{method:'POST',headers:sbH({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({k:key,data:g(key,null)})}).catch(function(){});}catch(e){}
  }
  function syncKey(key){
    if(SB_ON){ if(key!=='ddc_db_apps') kvUpsert(key); return; }
    if(!API)return; try{fetch(API+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table:key,data:g(key,null)})});}catch(e){}
  }
  function coll(key){return {
    list:function(){return g(key,[]);},
    save:function(a){s(key,a);syncKey(key);},
    add:function(o){var a=g(key,[]);o.id=o.id||uid();a.unshift(o);s(key,a);syncKey(key);return o;},
    update:function(id,patch){var a=g(key,[]);for(var i=0;i<a.length;i++)if(a[i].id===id){for(var p in patch)a[i][p]=patch[p];}s(key,a);syncKey(key);},
    remove:function(id){s(key,g(key,[]).filter(function(x){return x.id!==id;}));syncKey(key);}
  };}
  // applications: dedicated Supabase table ddc_apps (safe append, no clobber)
  function rowToApp(r){return {id:String(r.id),vacancy:r.vacancy,department:r.department,name:r.name,email:r.email,phone:r.phone,cover:r.cover,ts:r.ts,status:r.status||'new',resumeName:r.resume_name,resumeData:r.resume_data};}
  function appToRow(o){return {vacancy:o.vacancy||'',department:o.department||'',name:o.name||'',email:o.email||'',phone:o.phone||'',cover:o.cover||'',ts:o.ts||new Date().toISOString(),status:o.status||'new',resume_name:o.resumeName||null,resume_data:(o.resumeData&&(''+o.resumeData).length<2000000)?o.resumeData:null};}
  var baseApps=coll('ddc_db_apps');
  var appsColl = SB_ON ? {
    list:baseApps.list, save:baseApps.save,
    add:function(o){ var a=g('ddc_db_apps',[]); o.id=o.id||uid(); a.unshift(o); s('ddc_db_apps',a);
      try{fetch(SB_URL+'/rest/v1/ddc_apps',{method:'POST',headers:sbH({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(appToRow(o))})
        .then(function(r){return r.ok?r.json():null;}).then(function(rows){ if(rows&&rows[0]){var l=g('ddc_db_apps',[]);if(l[0])l[0].id=String(rows[0].id);s('ddc_db_apps',l);emit('ddc_db_apps');} }).catch(function(){});}catch(e){}
      return o; },
    update:function(id,patch){ baseApps.update(id,patch); var row={}; if(patch.status!=null)row.status=patch.status;
      if(Object.keys(row).length){try{fetch(SB_URL+'/rest/v1/ddc_apps?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:sbH({'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify(row)}).catch(function(){});}catch(e){}} },
    remove:function(id){ baseApps.remove(id); try{fetch(SB_URL+'/rest/v1/ddc_apps?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:sbH()}).catch(function(){});}catch(e){} }
  } : baseApps;
  // initial cloud pull
  if(SB_ON){
    ['ddc_db_users','ddc_db_ann','ddc_db_reqs','ddc_db_courses','ddc_db_chat','ddc_db_dm','ddc_db_progress','ddc_db_audit','ddc_db_kb','ddc_db_polls','ddc_db_events','ddc_db_ideas','ddc_db_mytasks','ddc_db_incidents','ddc_db_groups','ddc_db_gm'].forEach(function(t){
      sbGet('ddc_kv?k=eq.'+encodeURIComponent(t)+'&select=data').then(function(rows){
        if(rows&&rows[0]&&rows[0].data!=null){ s(t,rows[0].data); if(t==='ddc_db_users')migratePasswords(); emit(t); }
        else { kvUpsert(t); }
      });
    });
    sbGet('ddc_apps?select=*&order=ts.desc').then(function(rows){ if(rows){ s('ddc_db_apps',rows.map(rowToApp)); emit('ddc_db_apps'); } });
  }
  if(API&&!SB_ON){['ddc_db_users','ddc_db_ann','ddc_db_apps','ddc_db_reqs','ddc_db_courses','ddc_db_chat','ddc_db_progress','ddc_db_dm','ddc_db_audit','ddc_db_kb','ddc_db_kudos','ddc_db_ideas','ddc_db_status','ddc_db_polls','ddc_db_events','ddc_db_bookings','ddc_db_onbrd','ddc_db_oncall','ddc_db_incidents','ddc_db_docs','ddc_db_secmetrics','ddc_db_groups','ddc_db_gm'].forEach(function(k){fetch(API+'/load?table='+k).then(function(r){return r.json();}).then(function(d){if(d&&d.data){s(k,d.data);try{window.dispatchEvent(new CustomEvent('ddcdb-sync',{detail:{table:k}}));}catch(e){}}}).catch(function(){});});}
  // ── seeds for new portal modules ──
  if(!localStorage.getItem('ddc_db_kb')) s('ddc_db_kb',[
    {id:uid(),cat:'ИБ и безопасность',title:'Политика информационной безопасности',desc:'Основные правила ИБ для сотрудников: пароли, доступы, инциденты.',link:''},
    {id:uid(),cat:'ИТ',title:'Инструкция: подключение к VPN',desc:'Как настроить удалённый защищённый доступ к ресурсам ЦЦР.',link:''},
    {id:uid(),cat:'HR',title:'Как оформить отпуск',desc:'Порядок и сроки подачи заявления на отпуск.',link:''},
    {id:uid(),cat:'Регламенты',title:'Регламент Service Desk (1477)',desc:'Сроки и порядок обработки ИТ-заявок.',link:''}
  ]);
  if(!localStorage.getItem('ddc_db_status')) s('ddc_db_status',[
    {id:uid(),name:'Корпоративная почта',state:'ok'},
    {id:uid(),name:'Портал закупок',state:'ok'},
    {id:uid(),name:'VPN / удалённый доступ',state:'ok'},
    {id:uid(),name:'Внутренние информационные системы',state:'ok'},
    {id:uid(),name:'Контакт-центр 1477',state:'ok'}
  ]);
  if(!localStorage.getItem('ddc_db_polls')) s('ddc_db_polls',[
    {id:uid(),q:'Как вы оцениваете свою рабочую неделю?',opts:[{t:'Отлично',v:[]},{t:'Нормально',v:[]},{t:'Тяжело',v:[]}]}
  ]);
  if(!localStorage.getItem('ddc_db_events')) s('ddc_db_events',[
    {id:uid(),title:'Общее собрание коллектива',date:'2026-07-15',desc:'Итоги квартала и планы.'},
    {id:uid(),title:'Вебинар: кибербезопасность на рабочем месте',date:'2026-07-22',desc:'Обязательно для всех сотрудников.'}
  ]);
  if(!localStorage.getItem('ddc_db_bookings')) s('ddc_db_bookings',[]);
  if(!localStorage.getItem('ddc_db_onbrd')) s('ddc_db_onbrd',[]);
  if(!localStorage.getItem('ddc_db_oncall')) s('ddc_db_oncall',[
    {id:uid(),name:'Оператор SOC',date:new Date().toISOString().slice(0,10),shift:'Дневная смена 09:00–21:00',phone:'1477'}
  ]);
  if(!localStorage.getItem('ddc_db_incidents')) s('ddc_db_incidents',[]);
  if(!localStorage.getItem('ddc_db_docs')) s('ddc_db_docs',[]);
  if(!localStorage.getItem('ddc_db_secmetrics')) s('ddc_db_secmetrics',[{id:'m',phishing:14,vulns:3,critical:1,updated:new Date().toISOString()}]);
  return {
    users:coll('ddc_db_users'), ann:coll('ddc_db_ann'), apps:appsColl, reqs:coll('ddc_db_reqs'),
    courses:coll('ddc_db_courses'), chat:coll('ddc_db_chat'), dm:coll('ddc_db_dm'), audit:coll('ddc_db_audit'),
    kb:coll('ddc_db_kb'), kudos:coll('ddc_db_kudos'), ideas:coll('ddc_db_ideas'), status:coll('ddc_db_status'),
    polls:coll('ddc_db_polls'), events:coll('ddc_db_events'), bookings:coll('ddc_db_bookings'), onbrd:coll('ddc_db_onbrd'),
    mytasks:coll('ddc_db_mytasks'),
    oncall:coll('ddc_db_oncall'), incidents:coll('ddc_db_incidents'),
    docs:coll('ddc_db_docs'), secmetrics:coll('ddc_db_secmetrics'),
    groups:coll('ddc_db_groups'), gm:coll('ddc_db_gm'),
    logEvent:function(o){
      try{
        var a=g('ddc_db_audit',[]);
        o.id=o.id||uid(); o.ts=o.ts||new Date().toISOString();
        try{o.ua=o.ua||(navigator.userAgent||'');}catch(e){}
        a.unshift(o);
        if(a.length>500)a=a.slice(0,500); // keep last 500 events
        s('ddc_db_audit',a); syncKey('ddc_db_audit');
      }catch(e){}
      return o;
    },
    progress:{
      get:function(login){return (g('ddc_db_progress',{})[login])||[];},
      toggle:function(login,cid){var p=g('ddc_db_progress',{});var a=p[login]||[];var i=a.indexOf(cid);if(i>=0)a.splice(i,1);else a.push(cid);p[login]=a;s('ddc_db_progress',p);syncKey('ddc_db_progress');return a;}
    },
    auth:function(login,pass){var a=g('ddc_db_users',[]);for(var i=0;i<a.length;i++){if(a[i].login===login&&verifyPass(pass,a[i].passh||a[i].pass)){if(a[i].pass){a[i].passh=hashPass(pass);delete a[i].pass;s('ddc_db_users',a);}return a[i];}}return null;},
    hashPass:hashPass, verifyPass:verifyPass,
    lockout:(function(){
      var KEY='ddc_lockout', MAX=5, WIN=10*60*1000, LOCK=5*60*1000;
      function all(){return g(KEY,{});}
      return {
        check:function(login){var r=(all()[login])||{};var now=Date.now();
          if(r.until&&r.until>now)return {locked:true,leftMs:r.until-now,fails:r.fails||0};
          return {locked:false,leftMs:0,fails:r.fails||0};},
        fail:function(login){var m=all();var r=m[login]||{fails:0};var now=Date.now();
          if(r.first&&(now-r.first)>WIN){r.fails=0;r.first=now;}
          if(!r.first)r.first=now; r.fails=(r.fails||0)+1; r.last=now;
          if(r.fails>=MAX){r.until=now+LOCK;}
          m[login]=r; s(KEY,m); return this.check(login);},
        ok:function(login){var m=all(); if(m[login]){delete m[login]; s(KEY,m);}}
      };
    })(),
    session:{get:function(){return g('ddc_db_session',null);},set:function(u){s('ddc_db_session',u);},clear:function(){try{localStorage.removeItem('ddc_db_session');}catch(e){}}},
    uid:uid,
    reset:function(){['ddc_db_users','ddc_db_ann','ddc_db_apps','ddc_db_reqs','ddc_db_courses','ddc_db_chat','ddc_db_progress','ddc_db_dm','ddc_db_audit','ddc_db_session'].forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});}
  };
})();
