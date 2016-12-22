require 'rails_helper'

RSpec.describe 'exports/show', type: :view do
  before(:each) do
    @export = assign(:export, Export.create!(
      :name => 'Name',
      :created_by => 2,
      :updated_by => 3,
      :owned_by => 4
    ))
  end

  it 'renders name in <p>' do
    render
    expect(rendered).to match(/Name/)
  end
end
