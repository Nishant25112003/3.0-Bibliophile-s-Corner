const { format } = require('date-fns');// to get the current date
const express= require("express")
const ejs= require("ejs")
const pg = require("pg")
const path= require("path")
const multer = require('multer'); //important for file loading/input


const port=3000;
const app= express(); //connecting w/ express

const db= new pg.Client({
    user:"postgres",
    host:"localhost",
    database: "books",
    password:"Nishant@ily",
    port:"5432"
})
db.connect(); //connecting db


app.set("view engine", "ejs"); //setting ejs for index.ejs

app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); //using express.urlencoded instead of bodyParser because express is built-in

const storage = multer.diskStorage({
    destination: (req, file, cb)=>{
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
    
});  //setting destination of image and name

const upload= multer({storage:storage}); //initialising upload middleware



app.get('/', async (req, res) => {
    try {
        // Fetch all books from the database
        const booksResult = await db.query("SELECT * FROM books");
        const books = booksResult.rows.map(book => ({
            ...book,
            date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
        }));

        // Fetch favourite books if required
        const favouritesResult = await db.query("SELECT * FROM books WHERE favourites = true");
        const favouritesBooks = favouritesResult.rows.map(book => ({
            ...book,
            date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
        }));

        // Fetch unique genres from the genre table
        const genresResult = await db.query('SELECT DISTINCT genre_name FROM genre');
        const genres = genresResult.rows.map(row => row.genre_name); // Extract genre names from the result

        // Render the view with all data
        res.render('index', { 
            books: books,
            favouritesBooks: favouritesBooks,
            genres: genres
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while fetching data.");
    }
});


app.get('/allBooks', async(req,res)=>{
    try{
        const result = await db.query('SELECT * FROM books');
        const books = result.rows.map(book => ({
            ...book,
            date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
        }));
        

        res.render('books', {
            books:books
        })
    } catch (err){
        console.log(error)
    }
})




app.post('/search', async (req, res) => {
    const searchBook = req.body.search_Book;  // Ensure this matches the form's name attribute
    try {
        const result = await db.query("SELECT * FROM books WHERE LOWER(book_title) = LOWER($1)", [searchBook.trim()]);
        const books = result.rows.map(book => ({
            ...book,
          date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
          }));
     // Access the rows from the result

        if (books.length > 0) {
            res.render('search', { books: books[0] }); // Pass the first book in the results
        } else {
            res.render('search', { message: 'No books found' });
        }
    } catch (err) {
        console.error("Error querying the database:", err);
        res.status(500).send("Internal Server Error");
    } 

   
});


app.post('/summary', async (req, res) => {
    const { book_title, author, genre, rating, date_added } = req.body;
    
    try {
        const result = await db.query("SELECT * FROM books WHERE LOWER(book_title) = LOWER($1)", [book_title.trim()]);
        const books = result.rows.map(book => ({
        ...book,
      date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
      }));

        if (books.length > 0) {
            res.render('search', { books: books[0] });
        } else {
            res.render('search', { message: 'No books found' });
        }
    } catch (err) {
        console.error("Error handling additional operations:", err);
        res.status(500).send("Internal Server Error");
    }
});




app.post('/genre-selected', async (req, res) => {
    try {
        const { genre } = req.body;
        console.log('Received genre:', genre);

        const booksResult = await db.query('SELECT * FROM books WHERE genre = $1', [genre]);
        const books = booksResult.rows.map(book => ({
            ...book,
            date_added: format(new Date(book.date_added), 'MMM dd, yyyy')
        }));


        // Render the view with the genre and books
        res.render("genres", {
            genre: genre,
            books: books,
        
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
});






app.post('/submit', upload.single('photo'), async (req, res) => {
    const currentDate = format(new Date(), 'MMM dd, yyyy');
    const favourites = req.body.favourites;
    const { bookTitle, author, rating, genre } = req.body;
    const photoPath = req.file ? req.file.path : null;
    console.log(currentDate)

    try {
        // Insert book into the database
        await db.query(
            "INSERT INTO books (book_title, author, rating, genre, date_added, favourites, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [bookTitle, author, rating, genre, currentDate, favourites, photoPath]
        );

        await db.query(
            "INSERT INTO genre (genre_name) SELECT DISTINCT genre FROM books ON CONFLICT DO NOTHING"
        );


        // Fetch updated books from the database
        const result = await db.query("SELECT * FROM books");
        const books = result.rows;

        const successMessage = "Book Added Successfully!";

        // Render the view with the updated data
        res.render("index", { 
            successMessage: successMessage,
            books: books // Pass the updated books array to the view
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while adding the book.");
    }

    if (favourites== 'true'){

        try{
            const favouritesResult = await db.query('SELECT * FROM books WHERE favourites = $1', [true]);

        const favouritesBooks = favouritesResult.rows; //here favourite Books is an array and we are passing values in it

        res.render("index", { 
            successMessage: successMessage,
            favouritesBooks: favouritesBooks // Pass the updated books array to the view
        });

        } catch (err){
            res.status(500).send("An error occured");
        }
    }


});



app.post('/submitSummary', async (req, res) => {
    const book_title = req.body.book_title
    const book_id = req.body.book_id; // Use req.body to access form data
    const summary = req.body.summary;

    try {
        await db.query(
            'INSERT INTO summary (book_id, book_title,summarysection) VALUES ($1, $2, $3)', 
            [book_id,book_title, summary]
        );

        // Redirect to the home page after successful insertion
        res.redirect('/');
    } catch (err) {
        console.error("Error inserting summary:", err);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/summary/view', async (req, res) => {
  
    try {
        const result= await db.query('SELECT * FROM summary');
        const summary = result.rows;

        res.redirect('/',{
            summary: summary
        });
    } catch (err) {
        console.error("Error inserting summary:", err);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/', async (req, res) => {
    try {
       
        const result = await db.query('SELECT * FROM summary');
        const summaries = result.rows;
    
        console.log("Summaries:", summaries);
        
        // Render the view with the data
        res.render('index', { summaries: summaries });
    } catch (err) {
        console.error("Error retrieving summaries:", err);
        res.status(500).send("Internal Server Error");
    }
});







app.listen(port, () => {
    console.log(`Listening at port ${port}`);
});