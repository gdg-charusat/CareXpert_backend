class ApiResponse {
  statusCode: number;
  data: any;
  message: string;
  success: boolean;
  meta?: Record<string, any>;

  constructor(statusCode: number, data?: any, message: string = "Success", meta?: Record<string, any>) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    if (meta) {
      this.meta = meta;
    }
  }

  toJSON() {
    const response: Record<string, any> = {
      statusCode: this.statusCode,
      message: this.message,
      success: this.success,
      data: this.data,
    };
    if (this.meta) {
      response.meta = this.meta;
    }
    return response;
  }
}

export { ApiResponse };
