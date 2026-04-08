
export const testTimestampConversion = () => {
  console.log('\n🧪 TESTING TIMESTAMP CONVERSION\n');
  
  const mockFirestoreTimestamp = {
    toDate: () => new Date('2024-04-01T12:00:00Z'),
    seconds: 1712059200,
    nanoseconds: 0
  };
  
  const mockRawTimestamp = {
    seconds: 1712059200,
    nanoseconds: 0
  };
  
  try {
    const result1 = mockFirestoreTimestamp.toDate();
    console.log('✅ Test 1 PASS - toDate() conversion:', result1);
  } catch (error) {
    console.error('❌ Test 1 FAIL - toDate() conversion:', error);
  }
  
  try {
    const result2 = new Date(mockRawTimestamp.seconds * 1000);
    console.log('✅ Test 2 PASS - Raw timestamp conversion:', result2);
  } catch (error) {
    console.error('❌ Test 2 FAIL - Raw timestamp conversion:', error);
  }
  
  const mockNestedObject = {
    timestamp: mockFirestoreTimestamp,
    value: 'test'
  };
  
  try {
    const converted = {
      ...mockNestedObject,
      timestamp: mockNestedObject.timestamp.toDate()
    };
    console.log('✅ Test 3 PASS - Nested object conversion:', converted);
  } catch (error) {
    console.error('❌ Test 3 FAIL - Nested object conversion:', error);
  }
  
  const mockArray: any[] = [
    { id: 1, name: 'Item 1', timestamp: mockFirestoreTimestamp },
    { id: 2, name: 'Item 2', timestamp: mockRawTimestamp }
  ];
  
  try {
    const convertedArray = mockArray.map((item: any) => ({
      ...item,
      timestamp: (item.timestamp as any).toDate ? (item.timestamp as any).toDate() : new Date((item.timestamp as any).seconds * 1000)
    }));
    console.log('✅ Test 4 PASS - Array conversion:', convertedArray);
  } catch (error) {
    console.error('❌ Test 4 FAIL -Array conversion:', error);
  }
  
  console.log('\n✅ All conversion tests completed\n');
};

if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    (window as any).__ANIXI_TEST__ = {
      testTimestampConversion
    };
  }
}
