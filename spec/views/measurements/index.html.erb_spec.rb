require 'rails_helper'

RSpec.describe 'measurements/index', :type => :view do
  before(:each) do
    assign(:units, [
        Unit.create!(
                long_label: 'Thousands of Widgets',
                short_label: 'WidgThous'
        )
    ])
    assign(:measurements, [
      Measurement.create!(
        :prefix => 'Prefix',
        :data_portal_name => 'Data Portal Name',
        :unit_id => Unit.first.id,
        :percent => false,
        :real => true,
        :notes => 'MyText'
      ),
      Measurement.create!(
        :prefix => 'Prefix',
        :data_portal_name => 'Data Portal Name',
        :unit_id => Unit.first.id,
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
    assert_select 'tr>td', :text => Unit.first.id.to_s, :count => 2
    assert_select 'tr>td', :text => false.to_s, :count => 2
    assert_select 'tr>td', :text => true.to_s, :count => 2
    assert_select 'tr>td', :text => 'MyText'.to_s, :count => 2
  end
end
