declare module "svg-captcha" {
  interface CreateOptions {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    charPreset?: string;
  }

  interface CaptchaResult {
    data: string;
    text: string;
  }

  const svgCaptcha: {
    create: (options?: CreateOptions) => CaptchaResult;
  };

  export default svgCaptcha;
}
