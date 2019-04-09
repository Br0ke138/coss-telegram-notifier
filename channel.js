const TelegramBot = require('node-telegram-bot-api');
const Coss = require('coss-api-node');
const config = require('./config');

// ################# CONFIG ###################
// ################# CONFIG ###################

// replace the value below with the Telegram token you receive from @BotFather
const token = config.botToken;
const bot = new TelegramBot(token, {polling: true});

// How often should the bot check for order updates
const CHECK_RATE_IN_SECONDS = config.CHECK_RATE_IN_SECONDS;

// FOR MULTIPLE PAIRS
const TIME_BETWEEN_CALLS_IN_SECONDS = config.TIME_BETWEEN_CALLS_IN_SECONDS;

// Start bot and use /start to get your chat id
const CHAT_ID = config.CHAT_ID;

// COSS API KEYS
const PUBLIC_KEY = config.PUBLIC_KEY;
const PRIVATE_KEY = config.PRIVATE_KEY;

let pairs = config.PAIRS_TO_INITIALLY_ADD;

// ################# CONFIG ###################
// ################# CONFIG ###################

let interval;
let coss = new Coss({
    public_api_key: PUBLIC_KEY,
    private_api_key: PRIVATE_KEY,
});

// Open Orders + Partial Filled open orders
let open = {};


startBot();

function startBot() {
    if (interval) {
        clearInterval(interval);
    }

    bot.sendMessage(CHAT_ID, "Collecting orders ...");
    checkForUpdates();
}

function stopBot() {
    if (interval) {
        clearInterval(interval);
        bot.sendMessage(CHAT_ID, "Bot stopped");
    } else {
        bot.sendMessage(CHAT_ID, "Bot not running");
    }
}

function checkForUpdates() {
    if (pairs.length < 1) {
        bot.sendMessage(CHAT_ID, "No pairs to watch. Add some with /add");
    } else {
        processPair(pairs, 0);
    }
}

function processPair(pairs, index) {
    const pair = pairs[index];
    console.log('processing pair', pair);

    setTimeout(() => {
        processNewAndUpdatedOpenOrders(pair, (err) => {
            if (err) {
                console.log('Unable to fetch open Orders', err);
            }
            processCompletedOrders(pair, (err) => {
                if (err) {
                    console.log('Unable to fetch completed Orders', err);
                }
                if (pairs[index + 1]) {
                    processPair(pairs, index + 1);
                } else if (!interval) {
                    bot.sendMessage(CHAT_ID, "Bot started");

                    interval = setInterval(() => {
                        checkForUpdates();
                    }, CHECK_RATE_IN_SECONDS * 1000);
                }
            })
        });
    }, TIME_BETWEEN_CALLS_IN_SECONDS * 1000);
}

function processNewAndUpdatedOpenOrders(pair, cb) {
    coss.getOpenOrders(pair, 1000, 0, (err, resp, orders) => {
        if (err) {
            cb(err);
        } else {
            console.log('processing new and updated open Orders');
            orders.list.forEach((order) => {
                if (open[order.order_id]) {
                    if (open[order.order_id] !== order.executed) {
                        const msg =
                            'Order update:' + '\n' +
                            'Pair: ' + order.order_symbol + '\n' +
                            'Price: ' + order.order_price + '\n' +
                            'Side: ' + order.order_side + '\n' +
                            'Status: ' + order.status + '\n' +
                            'Progress: ' + order.executed + '/' + order.order_size + '(' + (order.executed * 100 / order.order_size).toFixed(0) + '%)';
                        bot.sendMessage(CHAT_ID, msg);
                        open[order.order_id] = order.executed;
                    }
                } else {
                    const msg =
                        'New Order:' + '\n' +
                        'Pair: ' + order.order_symbol + '\n' +
                        'Price: ' + order.order_price + '\n' +
                        'Side: ' + order.order_side + '\n' +
                        'Status: ' + order.status + '\n' +
                        'Progress: ' + order.executed + '/' + order.order_size + '(' + (order.executed * 100 / order.order_size).toFixed(0) + '%)';
                    bot.sendMessage(CHAT_ID, msg);
                    open[order.order_id] = order.executed;
                }
            });
            cb(null);
        }
    });
}

function processCompletedOrders(pair, cb) {
    coss.getCompletedAndCancelledOrders(pair, 2147483647, 0, (err, resp, orders) => {
        if (err) {
            cb(err);
        } else {
            console.log('processing completed Orders');
            orders.list.forEach((order) => {
                if (open[order.order_id]) {
                    if (open[order.order_id] && order.status === 'filled') {
                        const msg =
                            'Order filled:' + '\n' +
                            'Pair: ' + order.order_symbol + '\n' +
                            'Price: ' + order.order_price + '\n' +
                            'Side: ' + order.order_side + '\n' +
                            'Status: ' + order.status + '\n' +
                            'Progress: ' + order.executed + '/' + order.order_size + '(' + (order.executed * 100 / order.order_size).toFixed(0) + '%)';
                        bot.sendMessage(CHAT_ID, msg);
                    } else {
                        const msg =
                            'Order canceled:' + '\n' +
                            'Pair: ' + order.order_symbol + '\n' +
                            'Price: ' + order.order_price + '\n' +
                            'Side: ' + order.order_side + '\n' +
                            'Status: ' + order.status + '\n' +
                            'Progress: ' + order.executed + '/' + order.order_size + '(' + (order.executed * 100 / order.order_size).toFixed(0) + '%)';
                        bot.sendMessage(CHAT_ID, msg);
                    }
                    delete open[order.order_id];
                }
            });
            cb(null);
        }
    })
}
