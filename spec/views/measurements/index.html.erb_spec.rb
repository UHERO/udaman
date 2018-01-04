require 'rails_helper'

RSpec.describe 'measurements/index', :type => :view do
  before(:each) do
    assign(:measurements, [
      Measurement.create!(
        :prefix => 'Prefix',
        :data_portal_name => 'Data Portal Name',
        :unit_id => 42,
        :percent => false,
        :real => true,
        :notes => 'MyText'
      ),
      Measurement.create!(
        :prefix => 'Prefix',
        :data_portal_name => 'Data Portal Name',
        :unit_id => 42,
        :percent => false,
        :real => true,
        :notes => 'MyText'
      )
    ])
  end

  it 'renders a list of measurements' do
    render
    assert_select 'tr>td', :text => 'Prefix'.to_s, :count => 2
    assert_select 'tr>td', :text => 'Data Portal Name'.to_s, :count => 2
    assert_select 'tr>td', :text => 42.to_s, :count => 2
    assert_select 'tr>td', :text => false.to_s, :count => 2
    assert_select 'tr>td', :text => true.to_s, :count => 2
    assert_select 'tr>td', :text => 'MyText'.to_s, :count => 2
  end
end
