export const handleError = (error) => {
  // If the error is from Axios and has a response from the backend
  if (error.response) {
    const { data, status } = error.response;
    
    // Return custom message from backend if available
    if (data && data.message) {
      return data.message;
    }

    // Handle standard status codes
    switch (status) {
      case 400:
        return 'Bad Request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Forbidden. You do not have permission to perform this action.';
      case 404:
        return 'Not Found. The requested resource does not exist.';
      case 500:
        return 'Internal Server Error. Please try again later.';
      default:
        return `Error: ${status}. Something went wrong.`;
    }
  }

  // Handle network errors or other issues
  if (error.request) {
    return 'Network Error. Please check your internet connection.';
  }

  return error.message || 'An unexpected error occurred.';
};
