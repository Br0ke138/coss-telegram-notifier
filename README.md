# coss-telegram-notifier

## Installation
- Node.js is required
- Create your own telegram bot via https://telegram.me/botfather
- Create a COSS API KEY pair (trading disabled)

```sh
$ git clone https://github.com/Br0ke138/coss-telegram-notifier.git
$ cd coss-telegram-notifier
$ npm install
```

### Config
- Add the bot token + Api Keys to config.json
- Use the /start command. This will print your chat id
- Add the chat id to config.json
- CHECK_RATE_IN_SECONDS = Time between each update cycle
- TIME_BETWEEN_CALLS_IN_SECONDS = If watching multiple pairs, time between each pair

### Start
```sh
$ node index.js
```

### Commands
- /start prints your chatId which you also need to set in index.js
- /commands this
- /add to add a pair to watch
- /remove to remove a pair to watch
- /list to get a list of pairs to watch
- /watch starts the bot
- /stop stops the bot

### Contact
https://telegram.me/Br0ke138