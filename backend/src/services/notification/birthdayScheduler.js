const logger = require('../../common/logger');
const triggerService = require('./trigger.service');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let intervalId = null;

const startBirthdayScheduler = () => {
  if (intervalId) return;

  logger.info('Initializing Student Birthday Notification Scheduler...');

  try {
    triggerService.checkAndNotifyStudentBirthdays();
  } catch (err) {
    logger.error('Initial birthday scheduler run failed', { message: err.message });
  }

  intervalId = setInterval(() => {
    try {
      triggerService.checkAndNotifyStudentBirthdays();
    } catch (err) {
      logger.error('Scheduled birthday check failed', { message: err.message });
    }
  }, TWENTY_FOUR_HOURS_MS);
};

const stopBirthdayScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

module.exports = {
  startBirthdayScheduler,
  stopBirthdayScheduler,
};
