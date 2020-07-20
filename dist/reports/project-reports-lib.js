"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumCardProperty = exports.getCountFromLabel = exports.cardsWithLabel = void 0;
// TODO: separate npm module.  for now it's a file till we flush out
//
// filter cards by label case insensitive
//
function cardsWithLabel(cards, label) {
    // make all the labels lower case
    let filtered = cards.filter((card) => {
        card.labels = card.labels.map((label) => { return label.toLowerCase(); });
        return card.labels.indexOf(label.toLocaleLowerCase()) >= 0;
    });
    return filtered;
}
exports.cardsWithLabel = cardsWithLabel;
//
// Get number from a label by regex.  
// e.g. get 2 from label "2-wip", new RegExp("(\\d+)-wip")
// returns NaN if no labels match
//
function getCountFromLabel(card, re) {
    let num = NaN;
    for (let label of card.labels) {
        let matches = label.match(re);
        if (matches && matches.length > 0) {
            num = parseInt(matches[1]);
            if (num) {
                break;
            }
        }
    }
    return num;
}
exports.getCountFromLabel = getCountFromLabel;
function sumCardProperty(cards, prop) {
    return cards.reduce((a, b) => a + (b[prop] || 0), 0);
}
exports.sumCardProperty = sumCardProperty;
