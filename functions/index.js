const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { error } = require('firebase-functions/logger');

admin.initializeApp();
const db = admin.firestore();
const usersCollection = db.collection('users');

// POST: 유저 추가
exports.signUp = onRequest((req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { name, email } = req.body;
    // 이름, 이메일 존재하는 지 검사
    if (!name || !email) {
        return res.status(400).send({ error: 'Missing name or email '});
    }
    // 한글 검사
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(name)) {
        return res.status(400).send({ error: 'Name cannot contain Korean characters' });
    }
    
    // 이메일 형식 검사 (@가 포함되어 있는지)
    if (!email.includes('@')) {
        return res.status(400).send({ error: 'Invalid email format: must contain @ symbol' });
    }

    const createdAt = new Date();

    // 받은 name과 email을 database에 추가
    usersCollection
        .add({ name, email, createdAt })
        .then((newUserRef) => {
            res.status(201).send({ id: newUserRef.id, message: 'User created' });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
})


// GET: 유저 이름으로 데이터 조회
exports.getUser = onRequest((req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const userName = req.query.name;
    if (!userName) {
        return res.status(400).send({ error: 'Missing user name in query' });
    }

    usersCollection
        .where('name', '==', userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: 'User not found '});
            }

            const userDoc = querySnapshot.docs[0];
            res.status(200).send({ id: userDoc.id, ...userDoc.data() });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
})

// PUT: 유저 수정
exports.updateUser = onRequest((req, res) => {
    if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
    }

    const userName = req.query.name;
    const updateFields = req.body;

    if (!userName || !updateFields) {
        return res.status(400).send({ error: 'Missing user name or update data '});
    }
    // 이메일이 업데이트되는 경우에만 검증
    if (updateFields.email !== undefined) {
        // 이메일에 @ 포함 검사
        if (!updateFields.email.includes('@')) {
            return res.status(400).send({ error: 'Invalid email format: must contain @ symbol' });
        }
    }
    
    usersCollection
        .where('name', '==', userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: 'User not found' });
            }

            const userDoc = querySnapshot.docs[0];
            return userDoc.ref.update(updateFields);
        })
        .then(() => {
            res.status(200).send({ message: 'User updated successfully' });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
})

// DELETE: 유저 삭제
exports.deleteUser = onRequest((req, res) => {
    if (req.method !== 'DELETE') {
        return res.status(405).send('Method Not Allowed');
    }

    const userName = req.query.name;
    if (!userName) {
        return res.status(400).send({ error: 'Missing user name in query '});
    }
    usersCollection
        .where('name', '==', userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: 'User not found' })
            }

            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            // 계정 생성 시간 확인 (createdAt 필드가 있는 경우)
            if (userData.createdAt) {
                const createdTime = userData.createdAt.toDate(); // Firestore Timestamp를 Date로 변환
                const currentTime = new Date();
                const timeDifference = (currentTime - createdTime) / (1000 * 60); // 분 단위로 변환
                
                // 1분 이내에 생성된 계정이면 삭제 불가
                if (timeDifference < 1) {
                    return res.status(403).send({ 
                        error: 'Cannot delete accounts less than 1 minute old' 
                    });
                }
            }
            
            // 조건을 통과하면 삭제 진행
            return userDoc.ref.delete();
        })
        .then(() => {
            res.status(200).send({ message: 'User deleted successfully' });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
})