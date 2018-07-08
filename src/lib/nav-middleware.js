
export default (req, res, next) => {
  if (req.rawBody) {
    req._isNAVRequest = true;
  }
  next();
};

