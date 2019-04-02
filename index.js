const TelegramBot = require('node-telegram-bot-api');
const Coss = require('coss-api-node');

// replace the value below with the Telegram token you receive from @BotFather
const token = 'BOT_TOKEN';
const bot = new TelegramBot(token, {polling: true});

// How often should the bot check for order updates
// Try not to tickle the Rate Limit. It gets angry fast.
const CHECK_RATE_IN_SECONDS = 60;

// FOR MULTIPLE PAIRS
const TIME_BETWEEN_CALLS_IN_SECONDS = 5

// Start bot and use /start to get your chat id
const CHAT_ID = 1234567;

// COSS API KEYS
const PUBLIC_KEY = 'PUBLIC_KEY';
const PRIVATE_KEY = 'PRIVATE_KEY';

let pairs = [];

// A restart of the bot loses all added pairs which you added via /add
// Uncomment to add COSS-ETH to the watch list everytime the script gets started
// pairs = ['COSS-ETH']


let interval;
let coss = new Coss({
    public_api_key: PUBLIC_KEY,
    private_api_key: PRIVATE_KEY,
});

let filled = {};
let partial = {};


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, chatId);
    bot.sendMessage(chatId, "Use /commands for a list of commands");
});

bot.onText(/\/commands/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID) {
        if (CHAT_ID === chatId) {
            const msg =
                '/add to add a pair to watch' + '\n' +
                '/remove to remove a pair to watch' + '\n' +
                '/list to get a list of pairs to watch' + '\n' +
                '/watch starts the bot' + '\n' +
                '/stop stops the bot';
            bot.sendMessage(chatId, msg);
        } else {
            bot.sendMessage(chatId, 'MIEP MÖP. Thats not your bot (wrong chatId)');
        }
    } else {
        bot.sendMessage(chatId, 'Set your chatId in the bot code first\nchatId: ' + chatId);
    }
});


bot.onText(/\/watch/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID === chatId) {
        if (pairs.length < 1) {
            bot.sendMessage(chatId, "Use /add first to add a pair to watch");
        } else {
            startBot(chatId);
        }
    }
})

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID === chatId) {
        stopBot(chatId);
    }
})

bot.onText(/\/add/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID === chatId) {
        askForPair(chatId, function (pair) {
            if (pairs.includes(pair)) {
                bot.sendMessage(chatId, "Already watching " + pair);
            } else if (pair.includes('/') || !pair.includes('-') || pair.includes('_')) {
                bot.sendMessage(chatId, "Format: COSS-ETH");
                bot.sendMessage(chatId, "Use /add again");
            } else {
                if (interval) {
                    bot.sendMessage(chatId, "Collecting previous completed and partial filled orders");
                    checkOrders(chatId, pair.toUpperCase(), () => {
                        pairs.push(pair.toUpperCase());
                        bot.sendMessage(chatId, "Bot started watching " + pair.toUpperCase());
                    })
                } else {
                    pairs.push(pair.toUpperCase());
                    bot.sendMessage(chatId, pair.toUpperCase() + " added to the list. Start the bot with /watch");
                }
            }
        })
    }
});

bot.onText(/\/remove/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID === chatId) {
        askForPair(chatId, function (pair) {
            if (!pairs.includes(pair)) {
                bot.sendMessage(chatId, "Not watching " + pair);
            } else {
                pairs = pairs.filter(function (item) {
                    return item !== pair.toUpperCase();
                })
                bot.sendMessage(chatId, "Bot stopped watching " + pair.toUpperCase());
            }
        })
    }
});

bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    if (CHAT_ID === chatId) {
        if (pairs.length < 1) {
            bot.sendMessage(chatId, "List is empty. Add some pairs with /add");
        } else {
            bot.sendMessage(chatId, pairs.toString());
        }
    }
})

function askForPair(chatId, callback) {
    bot.sendMessage(chatId, "Insert Pair").then(() => {
        bot.once('message', (pair) => {
            callback(pair.text);
        })
    })
}

function startBot(chatId) {
    if (interval) {
        clearInterval(interval);
    }

    bot.sendMessage(chatId, "Collecting previous completed and partial filled orders");
    let counter = 0;
    pairs.forEach((pair) => {
        setTimeout(() => {
            savePrevious(pair, () => {
                bot.sendMessage(chatId, "Orders for " + pair + " collected.");
                counter++;
                if (counter === pairs.length) {
                    interval = setInterval(() => {
                        getOrderHistory(chatId);
                    }, CHECK_RATE_IN_SECONDS * 1000);
                    bot.sendMessage(chatId, "Bot started");
                }
            });
        }, TIME_BETWEEN_CALLS_IN_SECONDS * 1000)
    })
}

function stopBot(chatId) {
    if (interval) {
        clearInterval(interval);
        bot.sendMessage(chatId, "Bot stopped");
    } else {
        bot.sendMessage(chatId, "Bot not running");
    }
}

function getOrderHistory(chatId) {
    if (pairs.length < 1) {
        bot.sendMessage(chatId, "No pairs to watch. Add some with /add");
    } else {
        pairs.forEach(pair => {
            setTimeout(() => {
                checkOrders(chatId, pair);
            }, TIME_BETWEEN_CALLS_IN_SECONDS * 1000);
        })
    }
}

async function checkOrders(chatId, pair, cb = () => {}) {
    try {
        const completedOrders = await coss.getCompletedOrders({Limit: 100000, Symbol: pair})
        completedOrders.list.forEach(order => {
            if (order.status === 'filled') {
                if (!filled[order.order_id]) {
                    const msg =
                        'Pair: ' + order.order_symbol + '\n' +
                        'Side: ' + order.order_side + '\n' +
                        'Status: ' + order.status + '\n' +
                        'Amount: ' + order.executed;
                    bot.sendMessage(chatId, msg);
                    filled[order.order_id] = true;
                }
            } else if (order.status === 'partial_fill') {
                // Order not seen or executed amount updated
                if (!partial[order.order_id] || partial[order.order_id] !== order.executed) {
                    const msg =
                        'Pair: ' + order.order_symbol + '\n' +
                        'Side: ' + order.order_side + '\n' +
                        'Status: ' + order.status + '\n' +
                        'Progress: ' + order.executed + '/' + order.order_size + '(' + (order.executed * 100 / order.order_size).toFixed(0) + '%)';
                    bot.sendMessage(chatId, msg);
                    partial[order.order_id] = order.executed;
                }
            }
        })
        cb();

    } catch (e) {
        // bot.sendMessage(chatId, e);
        console.log(e);
    }
}

async function savePrevious(pair, cb) {
    try {
        const completedOrders = await coss.getCompletedOrders({Limit: 100000, Symbol: pair})
        completedOrders.list.forEach(order => {
            if (order.status === 'filled') {
                filled[order.order_id] = true;
            } else if (order.status === 'partial_fill') {
                partial[order.order_id] = order.executed;
            }
        })
        cb();

    } catch (e) {
        // bot.sendMessage(chatId, e);
        console.log(e);
    }
}