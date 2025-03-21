require 'rails_helper'

RSpec.describe Measurement, :type => :model do
  it 'should clean up excess whitespace from strings saved to attributes on create' do
    meas = Measurement.new(prefix: 'TEST1', data_portal_name: '', notes: '  ', table_prefix: ' FOO  ')
    meas.save!

    expect(meas.data_portal_name).to eq(nil), 'attribute set to empty string is not nullified'
    expect(meas.notes).to eq(nil), 'attribute set to whitespace string is not nullified'
    expect(meas.table_prefix).to eq('FOO'), 'attribute set to string with leading/trailing white is not stripped'
  end

  it 'should clean up excess whitespace from strings saved to attributes on update' do
    meas = Measurement.new(prefix: 'TEST1', data_portal_name: 'DPN', notes: 'NOTES', table_prefix: 'PREFIX')
    meas.save!
    meas.update!(data_portal_name: '', notes: '  ', table_prefix: ' PREFIX  ')

    expect(meas.data_portal_name).to eq(nil), 'attribute set to empty string is not nullified'
    expect(meas.notes).to eq(nil), 'attribute set to whitespace string is not nullified'
    expect(meas.table_prefix).to eq('PREFIX'), 'attribute set to string with leading/trailing white is not stripped'
  end
end
