require 'rails_helper'

RSpec.describe 'exports/index', type: :view do
  before(:each) do
    assign(:exports, [
      Export.create!(
        :name => 'Name'
      ),
      Export.create!(
        :name => 'Name'
      )
    ])
  end

  it 'renders a list of exports' do
    render
    assert_select 'tr>td', :text => 'Name'.to_s, :count => 2
  end
end
