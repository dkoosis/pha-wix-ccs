// public/constants.js

// Role definitions with IDs and descriptions
export const ROLES = {
    SITE_MEMBER: {
        ID: "2ade445c-7265-420a-8102-484abdd3dc54",
        NAME: "Site_Member",
        DESCRIPTION: "Someone who has created a profile on the Ceramics site."
    },
    CCS_INVITEE: {
        ID: "4ecb331a-1566-4879-9112-65103b74dd70",
        NAME: "CCS_Invitee",
        DESCRIPTION: "Someone who has applied and been invited by the Ceramics team to become a member of the Community Ceramics Studio."
    },
    CCS_MEMBER: {
        ID: "ad647c5b-efc7-4c21-b196-376d6ccd85b8",
        NAME: "CCS_Member",
        DESCRIPTION: "A member of the Community Ceramics Studio"
    },
    CCS_APPLICANT: {
        ID: "f3f8ed52-8f27-42dc-9265-97b5d5bb2125",
        NAME: "CCS_Applicant",
        DESCRIPTION: "Someone who has filled out the application form to join the Community Ceramics Studio."
    }
};

// Collection definitions with IDs and names
export const COLLECTIONS = {
    ALL_PRODUCTS: {
        ID: "00000000-000000-000000-000000000001",
        NAME: "All Products"
    },
    CLAY: {
        ID: "808fc574-e9ba-4047-c225-3de064e1d746",
        NAME: "Clay"
    },
    INVITEE: {
        ID: "c2465f08-2bee-800c-fe57-552cac54872e",
        NAME: "Invitee"
    },
    KILN_RENTAL: {
        ID: "6c9b4ecd-6cff-3949-4e3b-3c9f83ea04e9",
        NAME: "Kiln Rental"
    },
    PUBLIC: {
        ID: "73ee77a3-8088-44de-25b0-2f7036230425",
        NAME: "Public"
    },
    STUDIO_ESSENTIALS: {
        ID: "130be4ed-a668-43e7-2b0c-04f6b1acf964",
        NAME: "Studio Essentials"
    },
    STUDIO_MEMBER: {
        ID: "87b5bf4f-950d-2892-74cb-58456a5cd88d",
        NAME: "Studio Member"
    },
    STUDIO_SERVICES: {
        ID: "41409976-0600-635a-6772-8153749eda41",
        NAME: "Studio Services"
    }
};

// Other constants
export const DISPLAY_DELAY = 1500;

// Role to collection access mapping
export const ROLE_COLLECTIONS = {
    // Map which collections each role should see
    SITE_MEMBER: [COLLECTIONS.PUBLIC.ID],
    CCS_APPLICANT: [COLLECTIONS.PUBLIC.ID], // Update this if needed
    CCS_INVITEE: [COLLECTIONS.INVITEE.ID],
    CCS_MEMBER: [COLLECTIONS.STUDIO_MEMBER.ID]
};
