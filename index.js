const DiscordJS = require("discord.js");
const got = require("got");
const jsdom = require("jsdom");
const images = require("./images");
require("dotenv").config();

const { JSDOM } = jsdom;
const guildId = process.env.GUILD_ID;
const client = new DiscordJS.Client();

const mrTQuotes = async (func) => {
  const url = "https://www.brainyquote.com/authors/mr-t-quotes";
  const response = await got(url);
  const dom = new JSDOM(response.body);

  const pageNums = [
    ...dom.window.document.querySelector(".pagination").querySelectorAll("li"),
  ]
    .filter((i) => {
      if (i.querySelector("a")) {
        const possibleNum = i.querySelector("a").textContent;

        if (!isNaN(possibleNum)) {
          return parseInt(possibleNum);
        }
      }
    })
    .map((i) => parseInt(i.textContent));

  await Promise.all([url, ...pageNums].map((i) => got(`${url}_${i}`)))
    .then((res) => {
      return res.map((quotesDom) => {
        const dom = new JSDOM(quotesDom.body);
        const quoteNode = [
          ...dom.window.document.querySelectorAll('a[title="view quote"]'),
        ];
        return quoteNode;
      });
    })
    .then((quoteNodes) => quoteNodes.flat())
    .then((elements) => elements.map((elem) => elem.textContent))
    .then((finalQuotes) => func(finalQuotes))
    .catch((e) => console.log(new Error(e)));
};

const getApp = (guildId) => {
  const app = client.api.applications(client.user.id);

  if (guildId) app.guilds(guildId);

  return app;
};

const getOption = (options, opt) =>
  options.find((i) => i.name === opt).value || "";

client.on("ready", async () => {
  const commands = await getApp(guildId).commands.get();

  await getApp(guildId).commands.post({
    data: {
      name: "mrt",
      description: "Get a Mr. T quote!",
      options: [
        {
          name: "search-term",
          description:
            "Find a word or phrase that matches the first Mr. T quote I find!",
          required: false,
          type: 3, // string
        },
      ],
    },
  });

  console.log("\n\nMr. T Bot Ready to Pity the Fool\n\n");

  client.ws.on("INTERACTION_CREATE", async (interaction) => {
    const { name, options } = interaction.data;
    const command = name.toLowerCase();

    switch (command) {
      case "mrt":
        mrTQuotes((quotes) => {
          searchQuotes(
            quotes,
            interaction,
            options ? getOption(options, "search-term") : ""
          );
        });

        break;
    }
  });
});

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

const searchQuotes = (quotes, interaction, searchTerm) => {
  if (searchTerm === "") {
    const selectedQuote = quotes[getRandomInt(0, quotes.length)];
    reply(interaction, theEmbed(selectedQuote, "RANDOM"));
    return;
  }

  for (const quote of quotes) {
    if (quote.includes(searchTerm)) {
      reply(interaction, theEmbed(quote, searchTerm));
      break;
    }
  }
};

const reply = async (interaction, res) => {
  let data = {
    content: res,
  };

  if (typeof res === "object") {
    data = await createAPIMessage(interaction, res);
  }
  client.api.interactions(interaction.id, interaction.token).callback.post({
    data: { type: 4, data },
  });
};

const theEmbed = (quote, searchTerm) => {
  return new DiscordJS.MessageEmbed()
    .setTitle("⛓️ Mr.T Quote ⛓️")
    .setImage(images[getRandomInt(0, images.length)])
    .setDescription(quote)
    .setFooter(
      searchTerm === "RANDOM"
        ? "Search term randomly chosen"
        : "Search term: " + searchTerm
    );
};

const createAPIMessage = async (interaction, content) => {
  const { data, files } = await DiscordJS.APIMessage.create(
    client.channels.resolve(interaction.channel_id),
    content
  )
    .resolveData()
    .resolveFiles();
  return { ...data, files };
};

client.login(process.env.TOKEN);
