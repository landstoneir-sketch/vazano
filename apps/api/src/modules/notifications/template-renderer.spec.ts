import { renderNotificationTemplate } from './template-renderer';

describe('renderNotificationTemplate', () => {
  it('replaces known variables and tolerates optional missing values', () => {
    expect(renderNotificationTemplate('استعلام {{ rfqCode }} برای {{name}} {{missing}}', { rfqCode: 'VZ-100', name: 'سنگ نمونه' }))
      .toBe('استعلام VZ-100 برای سنگ نمونه ');
  });

  it('does not interpret template values as executable syntax', () => {
    expect(renderNotificationTemplate('{{value}}', { value: '<script>alert(1)</script>' }))
      .toBe('<script>alert(1)</script>');
  });
});
