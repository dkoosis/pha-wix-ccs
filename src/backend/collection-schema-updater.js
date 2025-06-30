// src/backend/collection-schema-updater.js
// Field mapping utilities for Fillout form data

export function getFieldMapping() {
    return {
        // Basic Info
        'First Name': 'firstName',
        'Last Name': 'lastName',
        'Email': 'email',
        'Phone Number': 'phoneNumber',
        'Website': 'website',
        'Instagram Handle': 'instagramHandle',
        
        // Address (use fields without "Untitled Address field" suffix)
        'Street': 'street',
        'City': 'city',
        'State': 'state',
        'State/Province': 'state',
        'Zip Code': 'zipCode',
        'Zip/Postal code': 'zipCode',
        
        // Experience
        'I have experience working independently with clay': 'hasIndependentExperience',
        'Briefly describe your experience and proficiency in working with clay:': 'experienceDescription',
        'I am familiar with health and safety as it relates to clay': 'knowsSafety',
        'Briefly describe some safety procedures you practice:': 'safetyDescription',
        'What kind of work do you do? Select all applicable techniques:': 'studioTechniques',
        'Powerhouse Arts welcomes ceramics artists working within a wide variety of traditions and techniques. Please tell us about your studio practice.': 'practiceDescription',
        
        // Community
        'What accommodation are you considering?': 'accommodationType',
        'The Community Ceramics Studio aims to foster a welcoming community and a safe clean work environment. How can you help support these goals?': 'communityGoalsSupport',
        'What interests you most about being part of a community studio and how do you hope to contribute?': 'communityInterests',
        'How did you hear about the Community Ceramics Studio at Powerhouse Arts?': 'howHeardAbout',
        'Questions or Comments?': 'questionsComments',
        'Question or Comment?': 'questionsComments',
        
        // Meta
        'Submission ID': 'submissionId',
        'Enrichment info': 'enrichmentInfo',
        'Send me your newsletter with ceramics-related events': 'newsletterOptIn'
    };
}

export function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim();
        return normalized === 'yes' || normalized === 'true' || normalized === '1';
    }
    return false;
}