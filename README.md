# TerraConnection Backend

A robust Node.js backend server that powers the TerraConnection Android application, providing RFID integration and data management capabilities.

## 🔗 Related Repositories
- Android App Repository: [TerraConnection Android App](https://github.com/razihel159/TerraConnection)

## 🛠 Tech Stack

- **Runtime Environment**: Node.js
- **Framework**: Express.js
- **Database**: 
  - ORM: Sequelize
  - Migrations: Sequelize CLI
- **Authentication**: JWT (JSON Web Tokens)
- **File Handling**: Multer
- **Environment**: dotenv
- **Architecture**: MVC Pattern

## 📁 Project Structure

```
rfid-backend/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── migrations/     # Database migrations
├── seeders/       # Database seeders
├── uploads/       # File upload directory
├── views/         # View templates
└── public/        # Static files
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or later)
- npm or yarn
- Database server (MySQL/PostgreSQL)

### Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/RenierRains/TerraConnection.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Configure your environment variables:
     ```env
     DB_HOST=your_db_host
     DB_USER=your_db_user
     DB_PASS=your_db_password
     DB_NAME=your_db_name
     JWT_SECRET=your_jwt_secret
     ```

4. Run database migrations:
   ```bash
   npx sequelize-cli db:migrate
   ```

5. Start the server:
   ```bash
   npm start
   ```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### RFID Operations
- `POST /api/rfid/scan` - Process RFID scan
- `GET /api/rfid/history` - Get scan history
- `PUT /api/rfid/update` - Update RFID data

### Data Management
- `GET /api/data` - Fetch data
- `POST /api/data` - Create new data
- `PUT /api/data/:id` - Update data
- `DELETE /api/data/:id` - Delete data

## 🔧 Development

### Database Management
- Create migration:
  ```bash
  npx sequelize-cli migration:generate --name migration-name
  ```
- Run migrations:
  ```bash
  npx sequelize-cli db:migrate
  ```
- Undo migrations:
  ```bash
  npx sequelize-cli db:migrate:undo
  ```

### Running Tests
```bash
npm test
```

### Code Style
- ESLint configuration included
- Following Airbnb JavaScript Style Guide

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b x/x`)
3. Commit your changes (`git commit -m 'x'`)
4. Push to the branch (`git push origin x/x`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

-  Project Manager && Initial work - [RenierRains](https://github.com/RenierRains)
