import moment from 'moment';

const formatDateAndTime = (dateTime) => {
  return moment(dateTime).format('MM/DD/YYYY HH:mm');
};

export default {
  formatDateAndTime,
};
