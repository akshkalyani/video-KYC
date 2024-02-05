const loadIndex = async (req, res) => {
  try {
    res.render("index.ejs");
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  loadIndex,
};
