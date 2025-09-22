/**
 * Function to extract web page content using the Tavily API.
 *
 * @param {Object} args - Arguments for the extraction.
 * @param {string} args.urls - The URL(s) to extract content from.
 * @param {boolean} [args.include_images=false] - Whether to include images in the extraction.
 * @param {string} [args.extract_depth="basic"] - The level of extraction depth ("basic" or "advanced").
 * @returns {Promise<Object>} - The result of the extraction request.
 */
const executeFunction = async ({ urls, include_images = false, extract_depth = 'basic' }) => {
  const apiUrl = 'https://api.tavily.com/extract';
  const token = process.env.TAVILY_API_KEY;

  const requestBody = {
    urls,
    include_images,
    extract_depth
  };

  try {
    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error extracting content:', error);
    return {
      error: `An error occurred while extracting content: ${error instanceof Error ? error.message : JSON.stringify(error)}`
    };
  }
};

/**
 * Tool configuration for extracting web page content using the Tavily API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'tavily_extract',
      description: 'Extract web page content using the Tavily API.',
      parameters: {
        type: 'object',
        properties: {
          urls: {
            type: 'string',
            description: 'The URL(s) to extract content from.'
          },
          include_images: {
            type: 'boolean',
            description: 'Whether to include images in the extraction.'
          },
          extract_depth: {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'The level of extraction depth.'
          }
        },
        required: ['urls']
      }
    }
  }
};

export { apiTool };