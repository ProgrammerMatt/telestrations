// Word bank for SketchySecrets game
// Categories: animals, food, objects, actions, places, people

const words = [
  // Animals
  "elephant", "giraffe", "penguin", "kangaroo", "octopus",
  "butterfly", "dinosaur", "dolphin", "flamingo", "gorilla",
  "hedgehog", "jellyfish", "koala", "lobster", "monkey",
  "narwhal", "ostrich", "panda", "rabbit", "snake",
  "tiger", "unicorn", "vulture", "walrus", "zebra",
  "dragon", "spider", "whale", "shark", "turtle",

  // Food
  "pizza", "hamburger", "spaghetti", "ice cream", "birthday cake",
  "hot dog", "taco", "sushi", "popcorn", "watermelon",
  "banana", "apple pie", "sandwich", "french fries", "donut",
  "pancakes", "bacon", "cookie", "cupcake", "pineapple",

  // Objects
  "umbrella", "telescope", "skateboard", "rocket ship", "treasure chest",
  "lightbulb", "scissors", "toothbrush", "microphone", "television",
  "bicycle", "guitar", "camera", "sunglasses", "ladder",
  "balloon", "candle", "flashlight", "magnet", "compass",
  "hourglass", "trophy", "crown", "sword", "shield",

  // Actions/Scenes
  "fishing", "surfing", "dancing", "sleeping", "flying",
  "swimming", "climbing", "cooking", "painting", "skiing",
  "skydiving", "juggling", "sneezing", "yawning", "laughing",
  "crying", "running", "jumping", "singing", "dreaming",

  // Places
  "beach", "mountain", "castle", "volcano", "waterfall",
  "island", "jungle", "desert", "igloo", "lighthouse",
  "treehouse", "spaceship", "haunted house", "circus", "zoo",

  // People/Characters
  "pirate", "wizard", "ninja", "astronaut", "cowboy",
  "mermaid", "robot", "vampire", "ghost", "superhero",
  "clown", "princess", "knight", "alien", "zombie",

  // Compound/Fun
  "cat wearing a hat", "dog on a skateboard", "fish in a bowl",
  "monkey eating banana", "pig with wings", "snail racing",
  "chicken crossing road", "cow jumping moon", "bear camping",
  "bird building nest", "frog on lily pad", "mouse with cheese",
  "snowman melting", "rainbow", "thunderstorm", "shooting star",
  "campfire", "fireworks", "sunrise", "tornado"
];

function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

function getRandomWords(count) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = {
  words,
  getRandomWord,
  getRandomWords
};
