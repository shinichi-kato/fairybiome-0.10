require("dotenv").config({
  path: '.env.local',
});

module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `FairyBiome chatbot`,
        short_name: `FairyBiome`,
        start_url: `/`,
        background_color: `#f7f0eb`,
        theme_color: `#a2466c`,
        display: `standalone`,
        icon: "static/images/icon.svg",
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `userAvatar`,
        path: `${__dirname}/static/user/avatar`,
      },
    },
  ],
}