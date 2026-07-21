window.TRIP_DATA = {
  meta: {
    id: "malaysia-bali-2026",
    name: "Malaysia Bali Travel Dashboard",
    title: "马来西亚 × 巴厘岛情侣旅行总控台",
    subtitle: "Malaysia × Bali · Couple Escape",
    startDate: "2026-07-20",
    endDate: "2026-07-26",
    origin: "成都",
    travelersCount: 2,
    status: "upcoming",
    version: "1.5.6",
    versionName: "Flight Watcher",
    versionLabel: "航班监控版",
    lastUpdated: "2026-07-21T23:18:15+08:00",
    weatherNote: "天气自动更新；海况保持TBD",
    style: ["不赶行程", "城市观光", "海岛度假", "出海浮潜", "看日落", "情侣拍照", "酒店体验"]
  },
  imageFallbacks: {
    cover: "assets/images/placeholder-cover.svg",
    hotel: "assets/images/placeholder-hotel.svg",
    food: "assets/images/placeholder-food.svg",
    map: "assets/images/placeholder-map.svg"
  },
  weatherLocations: [
    { id: "kuala-lumpur", name: "吉隆坡", latitude: 3.139, longitude: 101.6869, timezone: "Asia/Kuala_Lumpur", sea_condition: { status: "TBD", provider: "TBD" } },
    { id: "bali", name: "巴厘岛", latitude: -8.65, longitude: 115.2167, timezone: "Asia/Makassar", sea_condition: { status: "TBD", provider: "TBD" } }
  ],
  travelInbox: {
    visibility: "private-only",
    supportedTypes: ["pdf", "image"],
    acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/heic"],
    statuses: ["incoming", "processing", "verified", "archived"],
    entryFields: ["documentId", "fileName", "fileType", "category", "status", "createdAt", "verifiedAt"],
    workflow: ["incoming", "processing", "verified", "archived"],
    storageTarget: "private-layer",
    publicMetadataOnly: true,
    githubUploadsAllowed: false,
    items: []
  },
  documentRegistry: {
    visibility: "private-metadata-only",
    source: "travelInbox",
    supportedCategories: ["flight", "hotel", "immigration", "insurance", "transport", "receipt"],
    resultFields: ["title", "provider", "date", "relatedTripItem", "status"],
    items: []
  },
  documentReadiness: {
    publicSummaryOnly: true,
    categories: [
      { id: "flights", label: "Flights", labelZh: "航班资料", readyCount: 4, totalCount: 4, status: "ready" },
      { id: "hotels", label: "Hotels", labelZh: "酒店资料", readyCount: 5, totalCount: 5, status: "ready" },
      { id: "immigration", label: "Immigration", labelZh: "入境资料", readyCount: 7, totalCount: 7, status: "ready" },
      { id: "transport", label: "Transport", labelZh: "交通资料", readyCount: 0, totalCount: 0, status: "missing" }
    ],
    emergencyStatus: [
      { id: "passport", label: "护照", status: "saved" },
      { id: "visa", label: "签证", status: "saved" },
      { id: "arrival", label: "入境", status: "saved" }
    ]
  },
  travelers: [
    { id: "me", name: "我", role: "traveler" },
    { id: "partner", name: "女朋友", role: "traveler" }
  ],
  route: [
    { id: "chengdu-out", city: "成都", date: "2026-07-20", status: "upcoming" },
    { id: "kuala-lumpur-out", city: "吉隆坡", date: "2026-07-20", status: "upcoming" },
    { id: "bali", city: "巴厘岛", date: "2026-07-22", status: "pending" },
    { id: "kuala-lumpur-return", city: "吉隆坡", date: "2026-07-25", status: "pending" },
    { id: "chengdu-return", city: "成都", date: "2026-07-26", status: "upcoming" }
  ],
  flights: [
    {
      id: "flight-3u3995", airline: "四川航空", flightNumber: "3U3995", date: "2026-07-20",
      departureTime: "09:40", arrivalTime: "14:20", departureAirport: "成都天府国际机场",
      arrivalAirport: "吉隆坡国际机场", departureTerminal: "T1", arrivalTerminal: "T1",
      checkedBaggage: "TBD", connectionGroup: "separate", isThroughTicket: false,
      bookingStatus: "confirmed", checkInStatus: "pending", actualStatus: "等待确认",
      notes: "航班与时间已确认；托运行李额等待确认。", status: "confirmed"
    },
    {
      id: "flight-kl-bali", airline: "TBD", flightNumber: "OD306", date: "2026-07-22",
      departureTime: "09:00", arrivalTime: "12:00", departureAirport: "吉隆坡国际机场",
      arrivalAirport: "巴厘岛伍拉·赖国际机场（DPS）", departureTerminal: "TBD", arrivalTerminal: "TBD",
      checkedBaggage: "TBD", connectionGroup: "separate", isThroughTicket: false,
      bookingStatus: "confirmed", checkInStatus: "pending", actualStatus: "等待确认",
      notes: "因错过原航班，已改乘OD306；航站楼、行李额和实时状态等待确认。", status: "confirmed"
    },
    {
      id: "flight-bali-kl", airline: "TBD", flightNumber: "OD307", date: "2026-07-25",
      departureTime: "13:00", arrivalTime: "16:00", departureAirport: "巴厘岛伍拉·赖国际机场（DPS）",
      arrivalAirport: "吉隆坡国际机场", departureTerminal: "TBD", arrivalTerminal: "TBD",
      checkedBaggage: "TBD", connectionGroup: "return-separate", isThroughTicket: false,
      bookingStatus: "pending", checkInStatus: "pending", actualStatus: "等待确认",
      notes: "航班号与时间已录入；航空公司、航站楼、行李额和最终订单状态等待确认。抵达后需入境、取行李并重新值机。", status: "pending"
    },
    {
      id: "flight-3u3994", airline: "四川航空", flightNumber: "3U3994", date: "2026-07-26",
      departureTime: "00:20", arrivalTime: "04:50", departureAirport: "吉隆坡国际机场",
      arrivalAirport: "成都天府国际机场", departureTerminal: "TBD", arrivalTerminal: "TBD",
      checkedBaggage: "TBD", connectionGroup: "return-separate", isThroughTicket: false,
      bookingStatus: "confirmed", checkInStatus: "pending", actualStatus: "等待确认",
      notes: "7月25日晚转机后跨日于7月26日00:20起飞；航站楼和托运行李额等待确认。", status: "confirmed"
    }
  ],
  hotels: [
    {
      id: "hotel-ruma", name: "The RuMa Hotel and Residences", nameZh: "吉隆坡如玛酒店",
      image: "assets/images/kuala-lumpur-cover.webp", imageAlt: "吉隆坡城市与酒店氛围占位图",
      address: "7 Jalan Kia Peng, Kuala Lumpur", checkIn: "2026-07-20", checkOut: "2026-07-21",
      roomType: "TBD", breakfast: "等待确认", paid: false, bookingPlatform: "TBD",
      bookingStatus: "pending", depositAmount: "TBD", depositMethod: "等待确认现金或银联卡是否可用",
      phone: "TBD", orderAlias: "等待确认", notes: "尚未确认预订与押金方式。", status: "pending"
    },
    {
      id: "hotel-denpasar-airbnb", name: "Kuala Lumpur Airbnb", nameZh: "吉隆坡 Airbnb 民宿",
      image: "assets/images/kuala-lumpur-cover.webp", imageAlt: "吉隆坡城市与民宿氛围占位图",
      address: "Kuala Lumpur（准确地址等待确认）", checkIn: "2026-07-21", checkOut: "2026-07-22",
      roomType: "Airbnb 公寓（具体房型TBD）", breakfast: "等待确认", paid: false, bookingPlatform: "Airbnb",
      bookingStatus: "confirmed", depositAmount: "TBD", depositMethod: "等待确认",
      phone: "TBD", orderAlias: "已确认住宿（不保存订单号）", notes: "7月21日入住；7月22日07:00退房前往机场。", status: "confirmed"
    },
    {
      id: "hotel-kerobokan-airbnb", name: "Kerobokan Airbnb Villa", nameZh: "北库塔水明漾周边 Airbnb 别墅",
      image: "assets/images/bali-beach.webp", imageAlt: "北库塔水明漾周边别墅氛围占位图",
      address: "Jalan Taman Sari PCP 7, Kecamatan Kuta Utara, Bali", checkIn: "2026-07-22", checkOut: "2026-07-23",
      roomType: "Airbnb 别墅（具体房型TBD）", breakfast: "等待确认", paid: false, bookingPlatform: "Airbnb",
      bookingStatus: "confirmed", depositAmount: "TBD", depositMethod: "等待确认",
      phone: "TBD", orderAlias: "已确认住宿（不保存订单号）", notes: "努沙佩尼达出海结束后入住；不是水明漾海滩步行核心区，外出优先使用Grab；需要确认晚间入住和准确地图定位。", status: "confirmed"
    },
    {
      id: "hotel-hilton-bali", name: "Hilton Bali Resort", nameZh: "巴厘岛希尔顿度假酒店",
      image: "assets/images/bali-beach.webp", imageAlt: "巴厘岛希尔顿度假酒店氛围占位图",
      address: "Hilton Bali Resort（准确地址等待确认）", checkIn: "2026-07-23", checkOut: "2026-07-24",
      roomType: "园景双床房", breakfast: "等待确认", paid: false, bookingPlatform: "TBD",
      bookingStatus: "confirmed", depositAmount: "TBD", depositMethod: "等待确认",
      phone: "TBD", orderAlias: "已确认住宿（不保存订单号）", notes: "住宿与房型已确认；准确地址、早餐、押金和入住细节等待确认。", status: "confirmed"
    },
    {
      id: "hotel-radisson-uluwatu", name: "Radisson Blu Resort & Villas, Bali Uluwatu", nameZh: "巴厘岛乌鲁瓦图丽笙度假村及别墅",
      image: "assets/images/uluwatu-sunset.webp", imageAlt: "乌鲁瓦图度假酒店与日落氛围占位图",
      address: "Radisson Blu Resort & Villas, Bali Uluwatu（准确地址等待确认）", checkIn: "2026-07-24", checkOut: "2026-07-25",
      roomType: "园景豪华房", breakfast: "等待确认", paid: false, bookingPlatform: "TBD",
      bookingStatus: "confirmed", depositAmount: "TBD", depositMethod: "等待确认",
      phone: "TBD", orderAlias: "已确认住宿（不保存订单号）", notes: "住宿与房型已确认；准确地址、早餐、押金和退房细节等待确认。", status: "confirmed"
    }
  ],
  itinerary: [
    {
      id: "day-1", date: "2026-07-20", city: "成都 → 吉隆坡", theme: "成都 → 吉隆坡",
      keywords: ["抵达", "适应", "双子塔夜景"],
      image: "assets/images/kuala-lumpur-cover.webp", imageAlt: "吉隆坡城市天际线占位图",
      transport: "3U3995 · 09:40成都天府T1 → 14:20吉隆坡国际T1", status: "pending", confirmed: false, weather: "等待人工录入",
      periods: {
        morning: ["09:40 搭乘四川航空3U3995从成都天府国际机场T1出发"],
        noon: ["14:20 抵达吉隆坡国际机场T1"],
        afternoon: ["14:20-16:30 办理入境、取行李、购买网络和少量换汇", "16:30 前往The RuMa Hotel and Residences办理入住"],
        evening: ["18:30 前往KLCC双子塔拍照、在KLCC公园散步并欣赏夜景", "19:30 在阿罗街或Pavilion Kuala Lumpur用餐", "21:30 返回酒店"]
      },
      notes: ["第一天不要安排长距离移动。", "机场至酒店交通方式和费用等待确认。"],
      maps: [{ label: "如玛酒店", query: "The RuMa Hotel and Residences" }, { label: "双子塔", query: "Petronas Twin Towers Kuala Lumpur" }, { label: "阿罗街", query: "Jalan Alor Kuala Lumpur" }, { label: "Pavilion", query: "Pavilion Kuala Lumpur" }]
    },
    {
      id: "day-2", date: "2026-07-21", city: "吉隆坡", theme: "吉隆坡 Airbnb 民宿",
      keywords: ["布城", "粉红清真寺", "Airbnb"],
      image: "assets/images/putrajaya-mosque.webp", imageAlt: "布城粉红清真寺占位图",
      transport: "吉隆坡市内交通；2026-07-22 07:00 从吉隆坡 Airbnb 民宿退房后前往机场", status: "changed", confirmed: true, weather: "等待人工录入",
      periods: {
        morning: ["睡醒后早餐", "10:30 办理退房并寄存行李", "前往Putrajaya Pink Mosque"],
        noon: ["参观粉红清真寺", "湖边拍照"],
        afternoon: ["14:30 返回酒店取行李"],
        evening: ["入住吉隆坡 Airbnb 民宿"]
      },
      notes: ["住宿：吉隆坡 Airbnb 民宿", "入住：2026-07-21", "退房：2026-07-22 07:00"],
      maps: [{ label: "粉红清真寺", query: "Putra Mosque Putrajaya" }, { label: "吉隆坡机场", query: "Kuala Lumpur International Airport" }]
    },
    {
      id: "day-3", date: "2026-07-22", city: "Kuala Lumpur → Bali", theme: "航班变更 · OD306",
      keywords: ["OD306", "航班变更", "抵达巴厘岛"],
      image: "assets/images/nusa-penida.webp", imageAlt: "努沙佩尼达海景占位图",
      transport: "OD306 · 2026-07-22 09:00 Kuala Lumpur → Bali · 12:00 arrival", status: "confirmed", confirmed: true, weather: "等待人工录入",
      periods: {
        morning: ["09:00 OD306 Kuala Lumpur → Bali"],
        noon: ["12:00 arrival"],
        afternoon: ["酒店入住"],
        evening: ["晚餐休息"]
      },
      notes: ["因错过原航班，改乘 OD306 前往巴厘岛。"],
      maps: [{ label: "吉隆坡机场", query: "Kuala Lumpur International Airport" }, { label: "巴厘岛机场", query: "I Gusti Ngurah Rai International Airport" }]
    },
    {
      id: "day-4", date: "2026-07-23", city: "水明漾/北库塔 → 乌布 → Hilton Bali Resort", theme: "水明漾 → 乌布 → Hilton Bali Resort",
      keywords: ["乌布山谷", "情侣散步", "酒店休息"],
      image: "assets/images/ubud.webp", imageAlt: "乌布梯田与自然景观占位图",
      transport: "北库塔Airbnb → 乌布 → Hilton Bali Resort（建议包车，具体车辆TBD）", status: "pending", confirmed: false, weather: "等待人工录入",
      periods: {
        morning: ["办理北库塔Airbnb退房", "包车前往乌布", "游览Campuhan Ridge Walk，体验森林、山谷和情侣散步"],
        noon: ["在乌布中心午餐"],
        afternoon: ["二选一：Tegallalang Rice Terrace梯田拍照，或乌布咖啡馆休息", "16:00左右前往Hilton Bali Resort", "入住园景双床房"],
        evening: ["酒店休息"]
      },
      notes: ["包车车型、司机、出发时间和费用等待确认。", "从北库塔别墅换住Hilton Bali Resort，出发前确认车辆可容纳全部行李。"],
      maps: [{ label: "Campuhan Ridge Walk", query: "Campuhan Ridge Walk Ubud" }, { label: "Tegallalang梯田", query: "Tegallalang Rice Terrace Bali" }, { label: "Hilton Bali Resort", query: "Hilton Bali Resort" }]
    },
    {
      id: "day-5", date: "2026-07-24", city: "Hilton Bali Resort → 乌鲁瓦图", theme: "南部海岸 + 乌鲁瓦图日落",
      keywords: ["酒店体验", "乌鲁瓦图寺", "金巴兰海鲜"],
      image: "assets/images/uluwatu-sunset.webp", imageAlt: "乌鲁瓦图悬崖日落占位图",
      transport: "Hilton Bali Resort → Radisson Blu Uluwatu → 乌鲁瓦图寺 → 金巴兰 → 酒店", status: "pending", confirmed: false, weather: "等待人工录入",
      periods: {
        morning: ["Hilton酒店早餐", "泳池和海边体验", "办理退房并整理行李"],
        noon: ["前往Radisson Blu Uluwatu", "入住园景豪华房"],
        afternoon: ["酒店休息", "16:30 前往乌鲁瓦图寺", "欣赏悬崖、海浪和日落"],
        evening: ["前往金巴兰吃海鲜", "返回Radisson Blu Uluwatu休息"]
      },
      notes: ["从Hilton Bali Resort换住Radisson Blu Uluwatu，出发前确认车辆和行李安排。", "乌鲁瓦图寺、金巴兰晚餐和返程车辆等待确认。"],
      maps: [{ label: "Radisson Blu Uluwatu", query: "Radisson Blu Resort & Villas Bali Uluwatu" }, { label: "乌鲁瓦图", query: "Uluwatu Temple Bali" }, { label: "金巴兰", query: "Jimbaran Beach Bali" }]
    },
    {
      id: "day-6", date: "2026-07-25", city: "乌鲁瓦图 → DPS机场 → 吉隆坡 → 成都", theme: "返程",
      keywords: ["提前赴机场", "非联程转机", "跨日航班"],
      image: "assets/images/bali-beach.webp", imageAlt: "巴厘岛海滩占位图",
      transport: "Radisson Blu Uluwatu → DPS机场；OD307 13:00 DPS → 16:00 KUL；3U3994 00:20 KUL → 04:50成都", status: "pending", confirmed: false, weather: "等待人工录入",
      periods: {
        morning: ["酒店早餐", "不要安排景点", "整理行李并办理退房", "11:00左右前往DPS机场"],
        noon: ["办理OD307值机、托运和出境手续", "13:00 搭乘OD307从DPS出发"],
        afternoon: ["16:00 抵达KUL", "办理入境、取行李并确认后续航站楼"],
        evening: ["在吉隆坡机场等待并重新值机", "7月26日00:20 搭乘3U3994从KUL出发", "04:50 抵达成都"]
      },
      notes: ["具体离店时间需结合实时路况、酒店至DPS机场车程和OD307值机截止时间确认。", "两段机票若非联程，前段延误不会受到后段航班保护。", "必须预留入境、取行李、换航站楼和重新值机时间。"],
      maps: [{ label: "巴厘岛机场", query: "I Gusti Ngurah Rai International Airport" }, { label: "吉隆坡机场", query: "Kuala Lumpur International Airport" }]
    }
  ],
  transportPlan: [
    {
      date: "2026-07-22", route: "萨努尔码头 → 努沙佩尼达 → 萨努尔 → 北库塔",
      legs: [
        { from: "萨努尔码头", to: "努沙佩尼达", recommendedMode: "快船", estimatedDuration: "TBD", reservationRequired: "是", budget: { currency: "TBD", amount: "TBD" }, notes: "船班、集合点和行李规则等待确认。" },
        { from: "努沙佩尼达", to: "萨努尔码头", recommendedMode: "快船", estimatedDuration: "TBD", reservationRequired: "是", budget: { currency: "TBD", amount: "TBD" }, notes: "返程船班受天气和海况影响。" },
        { from: "萨努尔", to: "北库塔Airbnb", recommendedMode: "Grab/Gojek或提前预约车辆", estimatedDuration: "TBD", reservationRequired: "建议", budget: { currency: "TBD", amount: "TBD" }, notes: "先取寄存行李，再前往Jalan Taman Sari PCP 7。" }
      ]
    },
    {
      date: "2026-07-23", route: "北库塔 → 乌布 → Hilton Bali Resort",
      legs: [
        { from: "北库塔Airbnb", to: "乌布", recommendedMode: "包车", estimatedDuration: "TBD", reservationRequired: "是", budget: { currency: "TBD", amount: "TBD" }, notes: "确认车辆可容纳两人全部行李。" },
        { from: "乌布", to: "Hilton Bali Resort", recommendedMode: "同一包车", estimatedDuration: "TBD", reservationRequired: "是", budget: { currency: "TBD", amount: "TBD" }, notes: "计划16:00左右从乌布出发。" }
      ]
    },
    {
      date: "2026-07-24", route: "Hilton Bali Resort → Radisson Blu Uluwatu",
      legs: [
        { from: "Hilton Bali Resort", to: "Radisson Blu Resort & Villas, Bali Uluwatu", recommendedMode: "Grab或提前预约车辆", estimatedDuration: "TBD", reservationRequired: "建议", budget: { currency: "TBD", amount: "TBD" }, notes: "携带全部行李换酒店。" }
      ]
    },
    {
      date: "2026-07-25", route: "Radisson Blu Uluwatu → DPS机场",
      legs: [
        { from: "Radisson Blu Resort & Villas, Bali Uluwatu", to: "巴厘岛伍拉·赖国际机场（DPS）", recommendedMode: "提前预约车辆", estimatedDuration: "TBD", reservationRequired: "是", budget: { currency: "TBD", amount: "TBD" }, notes: "计划11:00左右出发；需按实时路况和OD307值机截止时间调整。" }
      ]
    }
  ],
  foodRecommendations: [
    { region: "吉隆坡", name: "阿罗街", type: "街区餐饮", reason: "餐饮选择集中，适合抵达首日晚餐。", budgetRange: "TBD", suitableTime: "7月20日19:30左右" },
    { region: "吉隆坡", name: "Pavilion Kuala Lumpur", type: "商场餐饮", reason: "靠近KLCC区域，便于根据体力灵活选择。", budgetRange: "TBD", suitableTime: "7月20日晚餐" },
    { region: "水明漾", name: "Potato Head Beach Club", type: "海滩俱乐部", reason: "适合海边休息和水明漾夜间体验。", budgetRange: "TBD", suitableTime: "7月22日日落后" },
    { region: "水明漾", name: "La Favela", type: "夜生活", reason: "可作为当晚第二站，根据体力决定是否前往。", budgetRange: "TBD", suitableTime: "7月22日晚间" },
    { region: "乌布", name: "Seniman Coffee", type: "咖啡馆", reason: "适合作为梯田方案之外的轻松休息选择。", budgetRange: "TBD", suitableTime: "7月23日下午" },
    { region: "乌布", name: "本地印尼菜", type: "当地餐饮", reason: "方便在乌布中心安排午餐。", budgetRange: "TBD", suitableTime: "7月23日午餐" },
    { region: "乌鲁瓦图/金巴兰", name: "金巴兰海鲜", type: "海滩海鲜晚餐", reason: "衔接乌鲁瓦图日落后的晚餐安排。", budgetRange: "TBD", suitableTime: "7月24日晚间" }
  ],
  travelTips: [
    { region: "马来西亚", category: "交通与现金", tips: ["市内交通可优先使用Grab。", "准备少量马币现金用于小额支付。"] },
    { region: "巴厘岛", category: "交通与服务", tips: ["市内交通可使用Grab或Gojek。", "小费习惯和金额需现场确认。", "结账前查看餐厅是否已包含服务费。"] },
    { region: "全程", category: "支付", tips: ["银联是否可用需要现场确认。", "准备少量现金。", "不要携带全部现金出门。"] }
  ],
  departureChecklist: [
    { category: "出海", items: ["泳衣", "防晒", "防水袋", "晕船药"] },
    { category: "巴厘岛", items: ["墨镜", "帽子", "拖鞋", "薄外套"] },
    { category: "机场", items: ["护照", "航班截图", "酒店订单"] }
  ],
  preDepartureChecklist: [
    { id: "mdac-first", category: "马来西亚入境", title: "填写 Malaysia Digital Arrival Card (MDAC)", description: "出发前3天完成；保存二维码截图；手机和云端各保存一次。", priority: "HIGH", status: "pending", dueDate: "2026-07-17", completed: false, owner: "共同完成" },
    { id: "passport-validity", category: "马来西亚入境", title: "确认护照有效期", description: "至少6个月有效期；检查护照页是否损坏。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "flight-orders", category: "马来西亚入境", title: "保存往返机票订单", description: "保存成都→吉隆坡、吉隆坡→巴厘岛、巴厘岛→吉隆坡、吉隆坡→成都四段订单；不在项目中保存完整订单号。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "hotel-orders", category: "马来西亚入境", title: "保存酒店订单", description: "保存The RuMa、Airbnb、Hilton和Radisson订单；不在项目中保存完整订单号。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "bali-tax", category: "印尼入境", title: "办理 Bali Tourist Tax", description: "完成巴厘岛游客税办理并保存付款记录；项目中不保存支付信息。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "indo-arrival", category: "印尼入境", title: "填写 All Indonesia Arrival Card", description: "入境前填写并保存二维码。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" }
  ],
  connectivityChecklist: [
    { id: "sim", category: "手机网络", title: "购买eSIM", description: "确认是否支持iPhone、是否支持热点及激活时间。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "required-apps", category: "APP安装", title: "安装必装APP", description: "安装Grab、Google Maps、WhatsApp、Google Translate、支付宝和微信。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "offline-maps", category: "离线地图", title: "下载吉隆坡和巴厘岛离线地图", description: "分别下载吉隆坡与巴厘岛离线地图并确认离线可打开。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" }
  ],
  paymentChecklist: [
    { id: "bank-card-check", category: "银行卡", title: "确认银行卡境外功能", description: "确认银联借记卡、境外支付功能和ATM取现功能；不要记录银行卡号码和密码。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "cash-preparation", category: "现金", title: "准备少量MYR和IDR现金", description: "准备少量马币MYR和印尼盾IDR；不要一次兑换大量现金。", priority: "MEDIUM", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "hotel-deposits", category: "酒店押金", title: "确认各住宿押金方式", description: "确认Hilton、Radisson及Airbnb押金方式；优先确认银联是否可用及是否接受现金。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" }
  ],
  boatTripChecklist: {
    date: "2026-07-22",
    tasks: [
      { id: "boat-package", category: "出海套餐", title: "确认努沙佩尼达出海套餐", description: "确认船公司、集合地点、集合时间、酒店接送、午餐和浮潜装备是否包含。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
      { id: "boat-items", category: "出海随身物品", title: "准备出海随身物品", description: "泳衣、防晒霜、墨镜、帽子、防水手机袋、晕船药、速干衣和拖鞋。", priority: "MEDIUM", status: "pending", dueDate: "2026-07-21", completed: false, owner: "共同完成" },
      { id: "boat-sea-status", category: "海况检查", title: "检查天气、风浪和船班状态", description: "出发前一天检查天气、风浪和船班状态；以安全判断为准。", priority: "HIGH", status: "pending", dueDate: "2026-07-21", completed: false, owner: "共同完成" }
    ]
  },
  hotelPreparation: [
    { id: "prep-ruma", category: "酒店入住", title: "确认 The RuMa 入住安排", description: "确认入住时间、早餐和押金。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "prep-airbnb", category: "酒店入住", title: "确认 Airbnb 入住安排", description: "确认晚间入住方式、房东联系方式、门锁方式和行李寄存；不在项目中保存房东私人信息。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "prep-hilton", category: "酒店入住", title: "确认 Hilton 入住安排", description: "确认入住时间、早餐、押金和房间需求。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "prep-radisson", category: "酒店入住", title: "确认 Radisson 入住安排", description: "确认入住时间、机场交通和早餐。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" }
  ],
  transportPreparation: [
    { id: "prep-kl-transport", category: "吉隆坡交通", title: "确认吉隆坡交通准备", description: "确认Grab账号和机场路线。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "prep-bali-transport", category: "巴厘岛交通", title: "确认巴厘岛交通准备", description: "确认Grab/Gojek、包车联系人和出海接送；不在项目中保存私人联系方式。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" },
    { id: "prep-return-transfer", category: "回程交通", title: "预约 Radisson 前往DPS机场车辆", description: "7月25日从Radisson前往DPS机场，建议提前预约车辆。", priority: "HIGH", status: "pending", dueDate: "2026-07-24", completed: false, owner: "共同完成" }
  ],
  emergencyPreparation: [
    { id: "prep-emergency-info", category: "紧急信息", title: "保存目的地紧急联系方式", description: "保存中国驻马来西亚使馆、中国驻登巴萨总领馆、当地报警及急救电话；不要在公开项目中存储护照照片、银行卡信息或密码。", priority: "HIGH", status: "pending", dueDate: "TBD", completed: false, owner: "共同完成" }
  ],
  departureStatus: {
    daysRemaining: 1,
    completionRate: 0,
    highPriorityRemaining: 21
  },
  finalDepartureChecklist: [
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "确认护照", description: "护照随身携带；确认有效期超过6个月。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "保存电子资料", description: "将往返机票、酒店订单、MDAC、印尼入境卡和Bali Tourist Tax凭证分别保存到手机相册和文件App；项目中不保存私人二维码或完整订单。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "手机充满电", description: "两台手机充满电并确认次日闹钟。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "携带充电设备", description: "携带充电器、数据线和充电宝；充电宝必须随身携带，不托运。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "确认eSIM", description: "确认eSIM购买完成、激活时间及是否需要落地后开启。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "测试旅行APP登录", description: "确认Grab、WhatsApp和Google Maps可正常登录或打开。", priority: "HIGH", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "准备马币MYR", description: "建议准备300-500 MYR；不要携带全部现金出门。", priority: "MEDIUM", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "准备印尼盾IDR", description: "建议准备100万-150万 IDR；不要一次兑换大量现金。", priority: "MEDIUM", completed: false },
    { phase: "Phase 1 出发前晚上", time: "2026-07-19 晚", task: "确认银行卡境外功能", description: "确认境外支付和ATM取现已开启；不要记录银行卡号、密码或CVV。", priority: "HIGH", completed: false },
    { phase: "Phase 2 成都机场出发当天", time: "2026-07-20 07:00-07:30", task: "前往成都天府机场", description: "3U3995于09:40起飞；按提前2小时到达机场执行。", priority: "HIGH", completed: false },
    { phase: "Phase 2 成都机场出发当天", time: "2026-07-20 到达机场后", task: "完成值机、托运和安检", description: "依次完成值机、托运行李和安检，并确认登机口。", priority: "HIGH", completed: false },
    { phase: "Phase 2 成都机场出发当天", time: "2026-07-20 安检前", task: "检查随身包", description: "确认随身包内有护照、手机、充电宝、钱包和航班截图。", priority: "HIGH", completed: false },
    { phase: "Phase 3 吉隆坡入境", time: "2026-07-20 14:20后", task: "完成吉隆坡入境流程", description: "下飞机后跟随Arrival / Immigration指示，完成马来西亚入境并取行李。", priority: "HIGH", completed: false },
    { phase: "Phase 3 吉隆坡入境", time: "2026-07-20 取行李后", task: "连接网络并打开Grab", description: "连接手机网络，确认Grab可用。", priority: "HIGH", completed: false },
    { phase: "Phase 3 吉隆坡入境", time: "2026-07-20 离开机场前", task: "执行机场安全提醒", description: "不要随便兑换大量现金，不乘坐陌生出租车。", priority: "HIGH", completed: false },
    { phase: "Phase 4 吉隆坡入住", time: "2026-07-20 入境后", task: "Grab前往The RuMa Hotel", description: "从机场乘Grab前往The RuMa Hotel，预计45-60分钟，实际以路况为准。", priority: "HIGH", completed: false },
    { phase: "Phase 4 吉隆坡入住", time: "2026-07-20 到店后", task: "完成The RuMa入住", description: "办理入住时确认护照、押金和WiFi。", priority: "HIGH", completed: false },
    { phase: "Phase 4 吉隆坡入住", time: "2026-07-20 晚", task: "前往KLCC双子塔", description: "根据抵达体力执行首晚KLCC双子塔安排，不增加长距离移动。", priority: "MEDIUM", completed: false },
    { phase: "Phase 5 7月22飞巴厘岛", time: "2026-07-22 07:00", task: "退房并前往KUL机场", description: "OD306于09:00起飞，07:00从吉隆坡Airbnb退房前往机场。", priority: "HIGH", completed: false },
    { phase: "Phase 5 7月22飞巴厘岛", time: "2026-07-22 值机前", task: "检查OD306登机资料", description: "确认护照、登机牌和行李额度。", priority: "HIGH", completed: false },
    { phase: "Phase 6 巴厘岛落地", time: "2026-07-22 12:00后", task: "完成DPS入境和取行李", description: "抵达DPS后完成入境并取行李。", priority: "HIGH", completed: false },
    { phase: "Phase 6 巴厘岛落地", time: "2026-07-22 取行李后", task: "开启网络并联系住宿", description: "开启手机网络，联系住宿并确认入住方式；不在项目中保存私人联系方式。", priority: "HIGH", completed: false },
    { phase: "Phase 6 巴厘岛落地", time: "2026-07-22 入境后", task: "前往巴厘岛住宿", description: "完成入境和取行李后前往住宿，实际以交通和入住安排为准。", priority: "HIGH", completed: false },
    { phase: "Phase 7 7月23出海前", time: "2026-07-22 晚", task: "准备出海随身包", description: "装好泳衣、防晒、墨镜、帽子、防水袋、晕船药和手机。", priority: "HIGH", completed: false },
    { phase: "Phase 7 7月23出海前", time: "2026-07-22 晚", task: "确认出海执行信息", description: "确认船班时间、集合地点和接送司机。", priority: "HIGH", completed: false }
  ],
  departureCountdown: {
    title: "出发倒计时",
    date: "2026-07-19",
    departureDate: "2026-07-20",
    daysRemaining: 1,
    todayFocusTasks: [
      { order: 1, task: "MDAC", priority: "HIGH", completed: false },
      { order: 2, task: "印尼入境资料", priority: "HIGH", completed: false },
      { order: 3, task: "eSIM", priority: "HIGH", completed: false },
      { order: 4, task: "出海确认", priority: "HIGH", completed: false }
    ],
    highestPriorityTasks: ["确认护照", "保存电子入境资料", "确认eSIM", "确认次日机场出发安排"]
  },
  riskAlerts: [
    { id: "nusa-weather", date: "2026-07-22", severity: "high", title: "努沙佩尼达天气与海况", text: "天气和海况可能影响快船、浮潜及Manta Point安排；以当天安全判断为准。", status: "active" },
    { id: "separate-ticket-return", date: "2026-07-25", severity: "critical", title: "巴厘岛至吉隆坡非联程风险", text: "OD307与3U3994若不是联程票，前段延误不会受到后段航班保护。", status: "active" },
    { id: "kul-terminal", date: "2026-07-25", severity: "high", title: "吉隆坡机场航站楼", text: "抵达后需确认入境、取行李、换航站楼和重新值机路线。", status: "active" },
    { id: "passport-custody", date: "2026-07-20", severity: "high", title: "护照保管", text: "不要把护照长期交给第三方；需要查验时在场并及时取回。", status: "active" },
    { id: "hotel-deposit", date: "2026-07-19", severity: "medium", title: "酒店押金", text: "出发前确认各住宿押金金额和可接受的支付方式。", status: "active" }
  ],
  coupleMoments: [
    { location: "双子塔", date: "2026-07-20", moment: "夜景情侣合照", status: "planned" },
    { location: "粉红清真寺", date: "2026-07-21", moment: "湖边与建筑合照", status: "planned" },
    { location: "努沙佩尼达", date: "2026-07-22", moment: "海景合照", status: "planned" },
    { location: "水明漾日落", date: "2026-07-22", moment: "日落剪影", status: "planned" },
    { location: "乌布山谷", date: "2026-07-23", moment: "山谷散步合照", status: "planned" },
    { location: "乌鲁瓦图悬崖", date: "2026-07-24", moment: "悬崖日落合照", status: "planned" }
  ],
  tasks: [
    { id: "passport-validity", title: "检查两本护照有效期", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不在项目中保存护照号码或照片。" },
    { id: "passport-photo-backup", title: "将护照资料页照片保存到私密iCloud目录", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不得导入本项目。" },
    { id: "mdac-first", title: "填写第一次马来西亚MDAC", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "保存非敏感完成状态即可。" },
    { id: "mdac-second", title: "填写第二次马来西亚MDAC", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-24", completed: false, notes: "按第二次入境日期核对填写窗口。" },
    { id: "indo-visa", title: "准备印度尼西亚落地签材料", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-20", completed: false, notes: "以官方最新要求为准。" },
    { id: "indo-arrival", title: "填写All Indonesia Arrival Card", category: "证件和入境", assignee: "共同完成", priority: "high", dueAt: "2026-07-20", completed: false, notes: "以官方最新入口为准。" },
    { id: "bali-tax", title: "支付或准备巴厘岛游客税", category: "证件和入境", assignee: "我", priority: "high", dueAt: "2026-07-20", completed: false, notes: "等待确认办理方式。" },
    { id: "return-ticket", title: "保存返程机票订单摘要", category: "证件和入境", assignee: "我", priority: "high", dueAt: "2026-07-19", completed: false, notes: "完整订单PDF保存在私密iCloud目录。" },
    { id: "hotel-orders", title: "保存酒店订单摘要", category: "证件和入境", assignee: "女朋友", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不保存完整订单号。" },
    { id: "insurance", title: "购买旅行保险", category: "证件和入境", assignee: "我", priority: "high", dueAt: "2026-07-19", completed: false, notes: "保单原件不得进入公开项目。" },
    { id: "buy-kl-bali", title: "购买吉隆坡飞巴厘岛机票", category: "航班", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "确认日期、机场与行李额。" },
    { id: "buy-bali-kl", title: "购买巴厘岛飞吉隆坡机票", category: "航班", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不得选择接近22:50抵达的高风险方案。" },
    { id: "ruma-deposit", title: "确认如玛酒店押金方式", category: "支付", assignee: "女朋友", priority: "high", dueAt: "2026-07-19", completed: false, notes: "确认现金或银联卡是否可用。" },
    { id: "unionpay-withdraw", title: "确认银联借记卡可境外取现", category: "支付", assignee: "我", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不记录卡号。" },
    { id: "bank-pin", title: "确认银行卡密码", category: "支付", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "密码只需本人记住，禁止写入任何文件。" },
    { id: "cash-myr", title: "准备马币", category: "支付", assignee: "我", priority: "medium", dueAt: "2026-07-19", completed: false, notes: "金额等待确认。" },
    { id: "cash-idr", title: "准备印尼盾", category: "支付", assignee: "女朋友", priority: "medium", dueAt: "2026-07-20", completed: false, notes: "金额等待确认。" },
    { id: "cash-split", title: "现金分开放置", category: "支付", assignee: "共同完成", priority: "medium", dueAt: "2026-07-20", completed: false, notes: "避免携带全部现金出海。" },
    { id: "orders-paid", title: "确认线上订单已经支付", category: "支付", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "逐项核对预算页状态。" },
    { id: "roaming", title: "开通国际漫游", category: "手机和网络", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "两台手机分别确认。" },
    { id: "sim", title: "准备eSIM或实体电话卡", category: "手机和网络", assignee: "我", priority: "high", dueAt: "2026-07-19", completed: false, notes: "等待最终方案。" },
    { id: "grab", title: "安装Grab", category: "手机和网络", assignee: "共同完成", priority: "medium", dueAt: "2026-07-19", completed: false, notes: "两台手机。" },
    { id: "whatsapp", title: "安装WhatsApp", category: "手机和网络", assignee: "共同完成", priority: "medium", dueAt: "2026-07-19", completed: false, notes: "两台手机。" },
    { id: "maps", title: "安装Google Maps", category: "手机和网络", assignee: "共同完成", priority: "medium", dueAt: "2026-07-19", completed: false, notes: "两台手机。" },
    { id: "offline-maps", title: "下载离线地图", category: "手机和网络", assignee: "女朋友", priority: "high", dueAt: "2026-07-19", completed: false, notes: "吉隆坡与巴厘岛。" },
    { id: "offline-translate", title: "下载翻译离线语言包", category: "手机和网络", assignee: "女朋友", priority: "medium", dueAt: "2026-07-19", completed: false, notes: "英语、马来语、印尼语。" },
    { id: "qr-screenshots", title: "保存所有二维码截图到私密相册", category: "手机和网络", assignee: "共同完成", priority: "high", dueAt: "2026-07-19", completed: false, notes: "不要放入公开项目。" },
    { id: "location-share", title: "开启情侣位置共享", category: "手机和网络", assignee: "共同完成", priority: "medium", dueAt: "2026-07-20", completed: false, notes: "确认电量与隐私设置。" }
  ],
  packing: [
    { category: "出海用品", items: ["泳衣", "防晒霜", "墨镜", "帽子", "防水手机袋", "晕船药", "速干衣", "拖鞋", "小毛巾"] },
    { category: "电子用品", items: ["手机", "充电器", "充电线", "充电宝", "马来西亚转换插头", "印度尼西亚转换插头", "耳机"] },
    { category: "常用药物", items: ["肠胃药", "退烧药", "创可贴", "驱蚊液", "晕船药", "个人常用药"] }
  ],
  documents: [
    { name: "护照", status: "pending", storage: "私密iCloud目录", publicSafe: false, notes: "项目只记录检查状态。" },
    { name: "MDAC完成凭证", status: "pending", storage: "私密iCloud目录", publicSafe: false, notes: "项目不保存完整表单。" },
    { name: "航班订单", status: "pending", storage: "私密iCloud目录", publicSafe: false, notes: "公开页仅保留航班号与状态。" },
    { name: "酒店订单", status: "pending", storage: "私密iCloud目录", publicSafe: false, notes: "公开页不得保存完整预订编号。" },
    { name: "旅行保险", status: "pending", storage: "私密iCloud目录", publicSafe: false, notes: "项目只记录购买状态。" }
  ],
  budget: [
    { id: "budget-flight", category: "机票", item: "全部航段", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待补录。" },
    { id: "budget-hotel", category: "酒店", item: "吉隆坡与巴厘岛", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待预订。" },
    { id: "budget-transport", category: "交通", item: "接送机与当地交通", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待估算。" },
    { id: "budget-food", category: "餐饮", item: "全程餐饮", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待估算。" },
    { id: "budget-sea", category: "出海", item: "努沙佩尼达", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待预订。" },
    { id: "budget-attractions", category: "景点", item: "门票与体验", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待估算。" },
    { id: "budget-insurance", category: "保险", item: "两人旅行保险", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "我", notes: "等待购买。" },
    { id: "budget-sim", category: "电话卡", item: "两人网络", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "我", notes: "等待选择方案。" },
    { id: "budget-shopping", category: "购物", item: "纪念品与个人购物", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "分别", notes: "等待估算。" },
    { id: "budget-other", category: "其他", item: "机动费用", currency: "CNY", plannedAmount: null, actualAmount: null, paid: false, payer: "共同", notes: "等待估算。" }
  ],
  exchangeRates: { base: "CNY", MYR: null, IDR: null, USD: null, note: "仅供旅行预算估算，实际以银行及支付平台结算为准。" },
  emergency: [
    { id: "malaysia-emergency", region: "马来西亚", label: "综合紧急服务", phone: "999", notes: "警方、消防、医疗等综合紧急服务。" },
    { id: "indonesia-police", region: "印度尼西亚", label: "报警", phone: "+62-110", notes: "巴厘岛当地报警。" },
    { id: "indonesia-medical", region: "印度尼西亚", label: "医疗急救", phone: "+62-119", notes: "巴厘岛医疗急救。" },
    { id: "consular-global", region: "全球", label: "外交部12308领保热线", phone: "+86-10-12308", notes: "24小时。" },
    { id: "consular-malaysia", region: "吉隆坡", label: "中国驻马来西亚使馆领保", phone: "+60-3-21645301", notes: "领事保护与协助。" },
    { id: "consular-bali", region: "巴厘岛", label: "中国驻登巴萨总领馆领保", phone: "+62-361-239902", notes: "领事保护与协助。" },
    { id: "insurance-contact", region: "旅行保险", label: "保险紧急援助", phone: "TBD", notes: "购买保险后补录。" },
    { id: "family-contact", region: "国内", label: "家庭紧急联系人", phone: "TBD", notes: "建议只保存在两台手机通讯录，不放公开页面。" }
  ],
  gallery: [
    { id: "kl-cover", src: "assets/images/kuala-lumpur-cover.webp", alt: "吉隆坡城市封面", label: "Kuala Lumpur" },
    { id: "twin-towers", src: "assets/images/petronas-towers.webp", alt: "吉隆坡双子塔", label: "Petronas Towers" },
    { id: "putrajaya", src: "assets/images/putrajaya-mosque.webp", alt: "布城粉红清真寺", label: "Putrajaya" },
    { id: "bali-beach", src: "assets/images/bali-beach.webp", alt: "巴厘岛海滩", label: "Bali" },
    { id: "nusa", src: "assets/images/nusa-penida.webp", alt: "努沙佩尼达海景", label: "Nusa Penida" },
    { id: "ubud", src: "assets/images/ubud.webp", alt: "乌布自然风景", label: "Ubud" },
    { id: "uluwatu", src: "assets/images/uluwatu-sunset.webp", alt: "乌鲁瓦图日落", label: "Uluwatu" },
    { id: "jimbaran", src: "assets/images/jimbaran-dinner.webp", alt: "金巴兰海滩晚餐", label: "Jimbaran" }
  ],
  alerts: [
    { id: "separate-ticket", severity: "critical", title: "非联程票风险", text: "巴厘岛飞吉隆坡与吉隆坡飞成都不是联程票时，前一段延误不会受到后一段航班保护。必须预留充足的入境、取行李、换航站楼和重新值机时间。", active: true },
    { id: "day2-airport-timing", severity: "warning", title: "7月22日机场时间提醒", text: "OD306于09:00从吉隆坡飞往巴厘岛，计划07:00从Airbnb退房前往机场；航站楼、行李额和实时状态仍需确认。", active: true },
    { id: "sea-safety", severity: "info", title: "出海安全", text: "提前服用晕船药，全程穿救生衣；风浪过大时接受取消或调整。", active: true }
  ],
  changeLog: [
    { at: "2026-07-21T23:18:15+08:00", version: "1.5.6", change: "Added cached Flight Watcher proxy, estimates, countdown and departure advice" },
    { at: "2026-07-21T23:04:38+08:00", version: "1.5.5", change: "Added Travel Day Mode countdown, trip timeline, quick expenses and activity templates" },
    { at: "2026-07-21T22:51:33+08:00", version: "1.5.4", change: "Added realtime travel status, priority actions and Budget Center first-screen ledger" },
    { at: "2026-07-21T22:31:43+08:00", version: "1.5.3", change: "Completed Command Center itinerary, expense and recent-change actions" },
    { at: "2026-07-21T10:50:05+08:00", version: "1.5.1", change: "Aligned trip data version with v1.5.1 production database release" },
    { at: "2026-07-20T01:45:45+08:00", version: "1.5.0", change: "Added authenticated Private Document Center" },
    { at: "2026-07-20T01:45:45+08:00", version: "1.5.0", change: "Added private Storage uploads with short-lived signed URLs" },
    { at: "2026-07-20T01:45:45+08:00", version: "1.5.0", change: "Added flight, hotel and immigration document associations" },
    { at: "2026-07-20T01:10:55+08:00", version: "1.4.3", change: "Added public-safe document readiness summaries" },
    { at: "2026-07-20T01:10:55+08:00", version: "1.4.3", change: "Added Private-Public Bridge status cards" },
    { at: "2026-07-20T01:10:55+08:00", version: "1.4.3", change: "Added emergency document saved states without private metadata" },
    { at: "2026-07-20T00:49:03+08:00", version: "1.4.2", change: "Added Document Import Assistant data flow" },
    { at: "2026-07-20T00:49:03+08:00", version: "1.4.2", change: "Added Travel Inbox processing states and Document Registry schema" },
    { at: "2026-07-20T00:49:03+08:00", version: "1.4.2", change: "Added mobile Inbox counters without file upload" },
    { at: "2026-07-20T00:30:00+08:00", version: "1.4.1", change: "Added privacy-safe Offline Pack" },
    { at: "2026-07-20T00:30:00+08:00", version: "1.4.1", change: "Added Travel Inbox index foundation" },
    { at: "2026-07-20T00:30:00+08:00", version: "1.4.1", change: "Added mobile-first Readiness Board" },
    { at: "2026-07-20T00:19:09+08:00", version: "1.4.0", change: "Added automatic destination weather data" },
    { at: "2026-07-20T00:19:09+08:00", version: "1.4.0", change: "Added hotel and flight registries" },
    { at: "2026-07-20T00:19:09+08:00", version: "1.4.0", change: "Added private-only Travel Inbox schema" },
    { at: "2026-07-19T23:30:45+08:00", version: "1.3.0", change: "Added Supabase shared checklist sync" },
    { at: "2026-07-19T23:30:45+08:00", version: "1.3.0", change: "Added cloud-first updates with localStorage fallback" },
    { at: "2026-07-19T23:30:45+08:00", version: "1.3.0", change: "Added syncing, synced and offline status" },
    { at: "2026-07-19T20:58:27+08:00", version: "1.2.3", change: "Added final 24-hour departure checklist" },
    { at: "2026-07-19T20:58:27+08:00", version: "1.2.3", change: "Added airport execution flow" },
    { at: "2026-07-19T20:58:27+08:00", version: "1.2.3", change: "Added arrival procedure" },
    { at: "2026-07-19T20:58:27+08:00", version: "1.2.3", change: "Added carry-on checklist" },
    { at: "2026-07-19T20:07:50+08:00", version: "1.2.2", change: "Improved travel readiness, cache updates and local image fallbacks" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added pre-departure checklist" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added immigration preparation" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added connectivity preparation" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added payment preparation" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added boat trip preparation" },
    { at: "2026-07-19T19:54:12+08:00", version: "1.2.1", change: "Added hotel confirmation checklist" },
    { at: "2026-07-19T21:15:00+08:00", version: "1.2.0", change: "Added complete travel execution guide" },
    { at: "2026-07-19T21:15:00+08:00", version: "1.2.0", change: "Added daily route planning" },
    { at: "2026-07-19T21:15:00+08:00", version: "1.2.0", change: "Added transport recommendations" },
    { at: "2026-07-19T21:15:00+08:00", version: "1.2.0", change: "Added food recommendations" },
    { at: "2026-07-19T21:15:00+08:00", version: "1.2.0", change: "Added travel safety reminders" },
    { at: "2026-07-19T20:45:00+08:00", version: "1.1.0", change: "新增4段已确认巴厘岛住宿，并同步7月21日至25日的入住退房、行李转移、换酒店与OD307机场提醒。" },
    { at: "2026-07-19T20:30:00+08:00", version: "1.0.1", change: "完成移动端首轮视觉检查并优化窄屏封面标题。" },
    { at: "2026-07-19T20:00:00+08:00", version: "1.0.0", change: "创建可运行的旅行总控台基础数据；所有未知信息保留为TBD或pending。" }
  ]
};

// ponytail: registries derive from the existing confirmed records so the public data has one source of truth.
{
  const data = window.TRIP_DATA;
  data.hotelRegistry = data.hotels.map((hotel) => ({
    id: hotel.id,
    hotel_name: hotel.name,
    check_in: hotel.checkIn,
    check_out: hotel.checkOut,
    address: hotel.address,
    check_time: "TBD",
    breakfast: hotel.breakfast,
    map_link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.address)}`,
    status: hotel.status
  }));
  data.flightRegistry = data.flights.map((flight) => ({
    id: flight.id,
    flight_number: flight.flightNumber,
    departure: { date: flight.date, time: flight.departureTime, airport: flight.departureAirport, terminal: flight.departureTerminal },
    arrival: { date: flight.date, time: flight.arrivalTime, airport: flight.arrivalAirport, terminal: flight.arrivalTerminal },
    status: flight.status
  }));
}

// ponytail: reuse the existing checklist UI and localStorage status handling instead of adding a second state system.
{
  const data = window.TRIP_DATA;
  const finalDueDates = {
    "Phase 1 出发前晚上": "2026-07-19",
    "Phase 2 成都机场出发当天": "2026-07-20",
    "Phase 3 吉隆坡入境": "2026-07-20",
    "Phase 4 吉隆坡入住": "2026-07-20",
    "Phase 5 7月22飞巴厘岛": "2026-07-22",
    "Phase 6 巴厘岛落地": "2026-07-22",
    "Phase 7 7月23出海前": "2026-07-22"
  };
  const finalDepartureItems = data.finalDepartureChecklist.map((item, index) => ({
    id: `final-departure-${index + 1}`,
    title: item.task,
    category: item.phase,
    owner: "共同完成",
    priority: item.priority,
    dueDate: finalDueDates[item.phase],
    completed: item.completed,
    description: `${item.time} · ${item.description}`
  }));
  const preparationItems = [
    ...data.preDepartureChecklist,
    ...data.connectivityChecklist,
    ...data.paymentChecklist,
    ...data.boatTripChecklist.tasks,
    ...data.hotelPreparation,
    ...data.transportPreparation,
    ...data.emergencyPreparation,
    ...finalDepartureItems
  ];
  const existingTaskIds = new Set(data.tasks.map((task) => task.id));
  data.tasks.push(...preparationItems.filter((item) => !existingTaskIds.has(item.id)).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    assignee: item.owner,
    priority: item.priority.toLowerCase(),
    dueAt: item.dueDate,
    completed: item.completed,
    notes: item.description
  })));
}
