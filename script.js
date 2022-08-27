let dataPoints = [];
let lastItem;
let chart;
let previousPrice = 0;
let color = 'black';
const coinPairs = [];
let coinPairUpper = 'BTCUSDT'
let coinPairLower = 'btcusdt'
let currentPair = coinPairUpper;
let balance;
let closePrice;  // close price from ws
let buyLimit = -100000000;
let sellLimit = 100000000;
let costOfBuying; //
let costofSelling // money made from selling
let currentCoinBalance;
let newlyBoughtQuantity;
let newlySoldQuantity;
let timeInterval = '1m';
let showInterval = "hh:mm";

let coin_pairs_url = 'https://api.binance.com/api/v1/exchangeInfo';
let api_url = `https://api.binance.com/api/v3/klines?symbol=${coinPairUpper}&interval=${timeInterval}&limit=120`;
let webSocket_url = `wss://stream.binance.com:9443/ws/${coinPairLower}@kline_${timeInterval}`;


const fundForm = document.querySelector('.fund-form');
const balanceElt = document.querySelector('.balance-amount');
const buyForm = document.querySelector('.buy-form');
const sellForm = document.querySelector('.sell-form');
const coinTicker = document.querySelectorAll('.cointicker');
const coinSearch = document.querySelector('.search-form');
const portfolio_ul = document.querySelector('.coins-ul');
const tickerPrice = document.querySelectorAll('.ticker-price');
const baseVolume = document.querySelector('.base-vol');
const quoteVolume = document.querySelector('.quote-vol');
const trades = document.querySelector('.trades');
const title = document.querySelector('title');
const errMsg = document.querySelector('.error-msg');
const timeIntervalButton = document.querySelector('.time-interval'); // Change chart interval

const searchInput = document.querySelector('.coin-search');
const suggestions = document.querySelector('.suggestions');
let suggestionList;


const coins = JSON.parse(localStorage.getItem('coins')) || []; // using to store coinsconst
let coin = {}  // object. using to store coin in "coins" array



async function getCoins() {
    const response = await fetch(coin_pairs_url);
    const data = await response.json();
    const symbolsArray = data.symbols;
    symbolsArray.forEach(e => {
        if (e.symbol.includes('USDT')) {
            coinPairs.push(e.symbol);
        }
    });
}


function findMatches(wordToMatch, coinPairs) {
    return coinPairs.filter(pairs => {
        const regex = new RegExp(wordToMatch, 'gi');
        return pairs.match(regex);
    })
}

// hide display matches when focus is out
function hide_displayMatches() {
    suggestions.innerHTML = null;
}

function displayMatches() {
    if (!this.value) {
        suggestions.innerHTML = null;
        return;
    }
    // console.log(this.value);
    const matchArray = findMatches(this.value, coinPairs);
    let html = matchArray.map(pairs => {
        return `
          <li class="suggestionlist">
            <span class="suggestionlist">${pairs}</span>
          </li>
        `;
    }).join('');
    suggestions.innerHTML = html;
    suggestionList = document.querySelectorAll('.suggestionlist');
    suggestionList.forEach(e => e.addEventListener('click', readClick));
}

async function generateChartData() {
    dataPoints = [];
    const response = await fetch(api_url);
    const data = await response.json();
    // console.log(data);
    data.forEach(e => {
        dataPoints.push({
            x: new Date(e[0]),
            y: [
                parseFloat(e[1]), parseFloat(e[2]), parseFloat(e[3]), parseFloat(e[4])
            ]
        })
    });
    chart.render();
    lastItem = dataPoints[dataPoints.length - 1];
}

function drawChart(showInterval) {
    chart = new CanvasJS.Chart("chartContainer", {
        animationEnabled: true,
        // interactivityEnabled: true,
        theme: "light2", // "light1", "light2", "dark1", "dark2"
        exportEnabled: true,
        zoomEnabled: true,
        zoomType: "xy",
        // backgroundColor: "black",
        title: {
            text: ""
        },
        subtitles: [{
            text: ""
        }],
        axisX: {
            interval: 1,
            valueFormatString: showInterval,
            labelFontSize: 12,
        },
        axisY: {
            prefix: "",
            title: "",
            labelFontSize: 12,
            // labelAngle: 50

        },
        toolTip: {
            content: "Date: {x}<br /><strong>Price:</strong><br />Open: {y[0]}, Close: {y[3]}<br />High: {y[1]}, Low: {y[2]}"
        },
        data: [{
            type: "candlestick",
            yValueFormatString: "$##0.00",
            risingColor: "#1DD33F",
            fallingColor: "red",
            fillOpacity: 1,
            dataPoints: dataPoints
        }]
    });

    const myHeaders = new Headers();
    myHeaders.append("Accept", "application/json");
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };
}

let connectionExist = false;
let ws = new WebSocket(webSocket_url);

function startSocketConnection() {
    if (connectionExist) {
        ws.close();
        ws = new WebSocket(webSocket_url);
    }
    let oldtime = 1;
    let flag = true;
    ws.onmessage = (e) => {
        if (flag) {
            oldtime = lastItem.x.getTime();
            flag = false;
        }
        let priceObj = JSON.parse(e.data);
        let newtime = priceObj.k.t;
        if (oldtime == newtime) {
            dataPoints.pop();
        }
        closePrice = parseFloat(priceObj.k.c);

        if (closePrice <= buyLimit) {
            updateBuy();
            buyLimit = -1000000000;
        }

        if (closePrice >= sellLimit) {
            updateSell();
            sellLimit = 1000000000;
        }

        previousPrice < closePrice ? color = 'green' : color = 'red';
        tickerPrice.forEach(e => {
            e.innerHTML = parseFloat(priceObj.k.c);
            e.style.color = color;
        })
        baseVolume.innerHTML = parseFloat(priceObj.k.v).toFixed(2);
        quoteVolume.innerHTML = parseFloat(priceObj.k.q).toFixed(2);
        trades.innerHTML = parseFloat(priceObj.k.n).toFixed(2);
        title.innerHTML = `${currentPair} : ${closePrice}`;
        previousPrice = closePrice;

        dataPoints.push({
            x: new Date(priceObj.k.t),
            y: [
                parseFloat(priceObj.k.o), parseFloat(priceObj.k.h), parseFloat(priceObj.k.l), closePrice
            ]
        })
        oldtime = newtime;
        chart.render();
    };
    connectionExist = true;
}

function readClick(e) {
    let coinName = this.innerText;
    changeCoin(coinName);
    coinSearch.reset();
}

function readForm(e) {
    e.preventDefault();
    const searchedCoin = this.querySelector('[name=coin-search]').value;
    changeCoin(searchedCoin);
    this.reset();
}

function changeCoin(coinName) {
    buyLimit = -100000000;
    coinPairUpper = coinName.toUpperCase();
    coinPairLower = coinName.toLowerCase();
    currentPair = coinPairUpper;
    coinTicker.forEach(e => {
        e.innerHTML = coinPairUpper;
    });
    api_url = `https://api.binance.com/api/v3/klines?symbol=${coinPairUpper}&interval=${timeInterval}&limit=120`;
    webSocket_url = `wss://stream.binance.com:9443/ws/${coinPairLower}@kline_${timeInterval}`;
    dataPoints = [];
    displayMatches()
    generateChartData();
    drawChart(showInterval);
    startSocketConnection();

}

function updateBalance() {
    if (isNaN(balance)) {
        balance = 0;
        console.log('NAN', balance);
    }
    localStorage.setItem('balance', balance);
    balanceElt.innerHTML = balance.toFixed(3);
}

function addFund(e) {
    e.preventDefault();
    const amountToAdd = this.querySelector('[name=add-funds]').value;
    console.log(parseFloat(amountToAdd));
    console.log(balance);
    balance += parseFloat(amountToAdd);
    updateBalance();
    this.reset();
}

function buyCoin(e) {
    e.preventDefault();
    let price;
    let quantity;
    price = parseFloat(this.querySelector('#buy-price').value);
    quantity = parseFloat(this.querySelector('#buy-quantity').value);
    costOfBuying = price * quantity;
    if (balance < costOfBuying) {
        errMsg.innerHTML = 'Not enough balance'
        setTimeout(() => {
            errMsg.innerHTML = '';
        }, 700)
        return;
    }
    buyLimit = price;
    newlyBoughtQuantity = quantity;
    this.reset();
}

function sellCoin(e) {
    e.preventDefault();
    let sellPrice;
    let sellQuantity;
    sellPrice = parseFloat(this.querySelector('#sell-price').value);
    sellQuantity = parseFloat(this.querySelector('#sell-quantity').value);
    let coinExist = document.querySelector(`#${currentPair}`);
    if (!coinExist) {
        errMsg.innerHTML = "You don't have coin"
        setTimeout(() => {
            errMsg.innerHTML = '';
        }, 700)
        return;
    }
    currentCoinBalance = parseFloat(document.querySelector(`#${currentPair}-count`).innerHTML);
    if (currentCoinBalance < sellQuantity) {
        errMsg.innerHTML = "Not enough coins"
        setTimeout(() => {
            errMsg.innerHTML = '';
        }, 700)
        return;
    }
    sellLimit = sellPrice;
    costofSelling = sellPrice * sellQuantity;
    newlySoldQuantity = sellQuantity;
    this.reset();
}

function updatePortfolioAfterBuying() {
    let coinExist = document.querySelector(`#${currentPair}`);
    if (coinExist) {
        currentCoinBalance = parseFloat(document.querySelector(`#${currentPair}-count`).innerHTML);
        currentCoinBalance += newlyBoughtQuantity;
        document.querySelector(`#${currentPair}-count`).innerHTML = currentCoinBalance;

        coins.forEach(coin => {
            if (coin.coinPair == currentPair) {
                console.log('before', coin.coinBalance);
                coin.coinBalance = currentCoinBalance;
                console.log('after', coin.coinBalance);
            }
        })
        localStorage.setItem('coins', JSON.stringify(coins));

    } else {
        currentCoinBalance = newlyBoughtQuantity;
        var html = `<li> 
                    <span id="${currentPair}">${currentPair}</span>
                    <span id="${currentPair}-count">${currentCoinBalance}</span>
                </li>`;
        portfolio_ul.innerHTML += html;
        coin = {
            'coinPair': currentPair,
            'coinBalance': currentCoinBalance
        };
        coins.push(coin);
        localStorage.setItem('coins', JSON.stringify(coins));
    }

}

function updatePortfolioAfterSelling() {
    currentCoinBalance = parseFloat(document.querySelector(`#${currentPair}-count`).innerHTML);
    currentCoinBalance -= newlySoldQuantity
    document.querySelector(`#${currentPair}-count`).innerHTML = currentCoinBalance;

    coins.forEach(coin => {
        if (coin.coinPair == currentPair) {
            console.log('before', coin.coinBalance);
            coin.coinBalance = currentCoinBalance;
            console.log('after', coin.coinBalance);
        }
    })
    localStorage.setItem('coins', JSON.stringify(coins));
}

function updateBuy() {
    balance -= costOfBuying;
    updateBalance();
    updatePortfolioAfterBuying();
}

function updateSell() {
    balance += costofSelling;
    updateBalance();
    updatePortfolioAfterSelling();
}

function loadLocalStorage() {
    balance = parseFloat(localStorage.getItem('balance'));
    updateBalance();
    coins.forEach(coin => {
        var html = `<li> 
                    <span id="${coin.coinPair}">${coin.coinPair}</span>
                    <span id="${coin.coinPair}-count">${coin.coinBalance}</span>
                </li>`;
        portfolio_ul.innerHTML += html;
    })
}

function changeInterval(e) {
    timeInterval = e.target.innerHTML;
    switch (timeInterval) {
        case "1m":
            showInterval = "hh:mm";
            break;
        case "5m":
            showInterval = "hh:mm";
            break;
        case "1h":
            showInterval = "DD/MM";
            break;
        case "4h":
            showInterval = "DD/MM";
            break;
        case "1d":
            showInterval = "DDD/MMM";
            break;
        case "1w":
            showInterval = "DD/MM/YY";
            break;
        case "1M":
            showInterval = "MMM/YY";
            break;
    }
    api_url = `https://api.binance.com/api/v3/klines?symbol=${coinPairUpper}&interval=${timeInterval}&limit=120`;
    webSocket_url = `wss://stream.binance.com:9443/ws/${coinPairLower}@kline_${timeInterval}`;
    console.log(api_url);
    generateChartData();
    startSocketConnection()
    drawChart(showInterval);
}

generateChartData();
drawChart(showInterval);
startSocketConnection();
getCoins();
loadLocalStorage();

searchInput.addEventListener('input', displayMatches);
window.addEventListener('click', hide_displayMatches);
coinSearch.addEventListener('submit', readForm);
fundForm.addEventListener('submit', addFund);
buyForm.addEventListener('submit', buyCoin);
sellForm.addEventListener('submit', sellCoin);
timeIntervalButton.addEventListener('click', changeInterval);


// function readClick() {
//     console.log("sss");
// }
// suggestions.addEventListener('click', readClick);
