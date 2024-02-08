const loadIndex = async (req, res) => {
  try {
    res.render("cholaReg.ejs");
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  loadIndex,
};
