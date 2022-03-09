const authPage = (permissions) => {
    return (req, res, next) => {
        try {
            const userRole = req.user.role;
            if (permissions.includes(userRole)) {
                next();
            }else {
                res.redirect("/logout")
            }
        } catch (error) {
            res.redirect("/login")
        }
    }
}




module.exports = {authPage};