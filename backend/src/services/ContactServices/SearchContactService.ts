import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { Op } from 'sequelize'

const SearchContactService = async (number: string | number): Promise<Contact[]> => {
    const contacts = await Contact
        .findAll({ 
            where: { 
                number: { 
                    [Op.like] : `%${number}%`
                } 
            } 
        });

    if (contacts.length === 0) {
        throw new AppError("ERR_NO_CONTACTS_FOUND", 404);
    }

    return contacts;
};

export default SearchContactService;