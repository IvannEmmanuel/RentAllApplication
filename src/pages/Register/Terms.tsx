import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

const Terms = () => {
    const navigation = useNavigation<any>();

    return (
        <ImageBackground source={require("../../../assets/registerBackground.png")} style={styles.container}>
            <View style={styles.termsContainer}>
                <TouchableOpacity onPress={() => { navigation.goBack() }}>
                    <Image source={require('../../../assets/backWhite.png')} style={styles.backImage} />
                </TouchableOpacity>
                <Text style={styles.termsText}>Terms and Conditions</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flex: 1, marginTop: 40, margin: 20 }}>
                    <Text style={styles.normalText}>
                        Welcome to <Text style={styles.textBold}>RentALL</Text>, a rental platform dedicated to connecting trusted users in Cagayan de Oro City (CDO),
                        Philippines. These Terms and Conditions govern your use of RentALL and outline your rights and responsibilities.
                    </Text>
                    <View style={{ marginTop: 20 }}>
                        <Text style={styles.textBold}>1. Scope & Acceptance</Text>
                        <Text style={styles.normalText}> • Exclusively serves verified residents of Cagayan de Oro City (CDO).</Text>
                        <Text style={styles.normalText}> • By registering, users agree to abide by these terms and local laws.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>2. User Registration & Authentication</Text>
                        <Text style={styles.normalText}> • You must be at least 18 years old and reside in Cagayan de Oro City.</Text>
                        <Text style={styles.normalText}> • All users must register and create an account.</Text>
                        <Text style={styles.normalText}> • You agree to provide accurate and up-to-date information during registration.</Text>
                        <Text style={styles.normalText}> • Users must not impersonate others or misrepresent their identity.</Text>
                        <Text style={styles.normalText}> • Lessors must submit valid ID (e.g., government-issued) and proof of CDO residency for the verification process to ensure trust and safety.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>3. Rental Categories & Listings</Text>
                        <Text style={styles.normalText}>3.1 Permitted Categories</Text>
                        <Text style={styles.normalText}> • Clothing & Accessories</Text>
                        <Text style={styles.normalText}> • Tools & Equipment</Text>
                        <Text style={styles.normalText}> • Electronics</Text>
                        <Text style={styles.normalText}> • Home Goods & Furniture</Text>
                        <Text style={styles.normalText}>3.2 Listing Requirements</Text>
                        <Text style={styles.normalText}> • Accurate descriptions, clear photos, and pricing.</Text>
                        <Text style={styles.normalText}> • Prohibited items: weapons, illegal goods, or hazardous materials.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>4. Listing and Renting</Text>
                        <Text style={styles.normalText}> • Lessors (item owners) may list items with clear descriptions and accurate images.</Text>
                        <Text style={styles.normalText}> • Renters must return items in the same condition and by the agreed return time.</Text>
                        <Text style={styles.normalText}> • Late returns or damages may incur penalties or disputes.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>5. Payments</Text>
                        <Text style={styles.normalText}> • RentALL does not process or facilitate payments. All financial transactions are handled directly between the lessor (provider) and renter.</Text>
                        <Text style={styles.normalText}> • Renters are required to provide a down payment as agreed upon by both parties.</Text>
                        <Text style={styles.normalText}> • The renter must submit proof of down payment (e.g., screenshot of bank/e-wallet transfer, receipt) to the lessor as a reference for verification.</Text>
                        <Text style={styles.normalText}> • The remaining balance, if any, must be settled according to the agreement between both parties.</Text>
                        <Text style={styles.normalText}> • RentALL shall not be held liable for:</Text>
                        <Text style={styles.normalText}> o	Failed or fraudulent payments</Text>
                        <Text style={styles.normalText}> o	Disputes over payment amounts, refunds, or delays</Text>
                        <Text style={styles.normalText}> o	Issues related to damage, item returns, or non-fulfillment</Text>
                        <Text style={styles.normalText}> • Users are encouraged to keep all communication and proof of transactions documented in case of disputes.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>6. Ratings and Reviews</Text>
                        <Text style={styles.normalText}> • After each transaction, renters may leave reviews.</Text>
                        <Text style={styles.normalText}> • Users must submit honest, respectful, and non-defamatory feedback.</Text>
                        <Text style={styles.normalText}> • RentALL reserves the right to remove inappropriate reviews.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>7. Notifications</Text>
                        <Text style={styles.normalText}>RentALL may send real-time notifications to users</Text>
                        <Text style={styles.normalText}> • New rental inquiries or interest from renters</Text>
                        <Text style={styles.normalText}> • Confirmation that a listing has been marked as rented</Text>
                        <Text style={styles.normalText}> • 	Return date reminders</Text>
                        <Text style={styles.normalText}> • Admin alerts, announcements, or account-related messages</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>8. Liability & Disputes</Text>
                        <Text style={styles.normalText}>User Responsibility: RentALL is not liable for damage/misuse of rented items.</Text>
                        <Text style={styles.normalText}>Dispute Resolution: Users and providers must attempt mediation via the in-app chat.</Text>
                        <Text style={styles.normalText}>Unresolved issues escalate to RentALL's admin team for arbitration.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>9. Admin Dashboard Authority</Text>
                        <Text style={styles.normalText}>Admin Rights:</Text>
                        <Text style={styles.normalText}> • Suspend/terminate accounts violating T&C.</Text>
                        <Text style={styles.normalText}> • Resolve disputes and monitor transactions.</Text>
                        <Text style={styles.normalText}> • 	Remove inappropriate listings.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>10. Termination</Text>
                        <Text style={styles.normalText}> • RentALL may suspend accounts for:</Text>
                        <Text style={styles.normalText}> • Fraudulent activity.</Text>
                        <Text style={styles.normalText}> • Repeated policy violations.</Text>
                        <Text style={styles.normalText}> • Failure to resolve disputes fairly.</Text>
                    </View>
                    <View>
                        <Text style={styles.textBold}>11. Data Privacy</Text>
                        <Text style={styles.normalText}> • Complies with the Philippine Data Privacy Act (RA 10173).</Text>
                        <Text style={styles.normalText}> • User data is collected for transaction processing and will not be sold.</Text>
                    </View>
                </View>
            </ScrollView>
        </ImageBackground>
    )
}

export default Terms

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
    },
    backImage: {
        width: 25,
        height: 25,
        marginLeft: 10
    },
    termsText: {
        color: 'white',
        fontSize: 26,
        fontFamily: 'DM-Bold',
        marginLeft: 10
    },
    normalText: {
        fontSize: 16,
        fontFamily: 'DM-Regular',
        lineHeight: 24
    },
    textBold: {
        fontFamily: 'DM-Bold',
        fontSize: 16
    }
})